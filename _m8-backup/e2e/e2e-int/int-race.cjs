// M8 integration acceptance, spec 2.9 items 2, 3, 4, 5 and 7 (plus the KP track-data check).
// TV + 3 pads (A Drag steer, B Buttons, C Drag then switched to Buttons in Settings mid-race) + one
// keyboard player. Each pad drives by touch (TV overlay shows steer and gas), pad B reloads
// mid-race and must come back as the same car with a working controller, R chip and stuck hint;
// then autopilot (debug P) finishes the full race: lap records (POST 200, GET, results board),
// the play-again vote back to the lobby, and no pageerror anywhere.
//
// Usage: node int-race.cjs <httpPort> <httpsPort>      env: TAG (screenshot prefix), RACE_MIN (90)
const L = require('./lib.cjs');
const { HTTP, sleep, log, check, poll, overlay, huds, hudFor, rect, tvShot, padShot } = L;

const RACE_MIN = Number(process.env.RACE_MIN ?? 90);
// Unique names per run, so the lap board check is not fooled by earlier runs on the same server.
const RUN = Math.random().toString(36).slice(2, 5);
const PLAYERS = [
  { key: 'A', name: `Ava ${RUN}`, colour: 'Lagoon', mode: 'drag' },
  { key: 'B', name: `Ben ${RUN}`, colour: 'Taxi', mode: 'buttons' },
  { key: 'C', name: `Cleo ${RUN}`, colour: 'Flamingo', mode: 'drag' },
];
const KEYS = 'Keys WASD';

(async () => {
  const t0 = Date.now();
  // KP: the Kestrel Pines layout files are served (they exist only once P2 is merged).
  const layout = await fetch(`${HTTP}/tracks/kestrel-pines/base.layout.json`).catch(() => null);
  const layoutJson = layout && layout.ok ? await layout.json().catch(() => null) : null;
  check(
    'KP',
    layoutJson && layoutJson.name === 'Kestrel Pines',
    `GET /tracks/kestrel-pines/base.layout.json serves the Kestrel Pines layout (${layout ? `${layout.status} ${layout.headers.get('content-type')}` : 'no answer'})`,
  );

  const browser = await L.launch();
  const { tv, code } = await L.openTv(browser);
  log('room', code, 'run tag', RUN);

  const lapPosts = [];
  const lapGets = [];
  tv.on('response', (response) => {
    const url = response.url();
    if (!url.includes('/api/laps')) return;
    const method = response.request().method();
    if (method === 'POST') {
      let body = null;
      try {
        body = JSON.parse(response.request().postData() ?? 'null');
      } catch {
        body = null;
      }
      lapPosts.push({ status: response.status(), body });
      log(`TV POST /api/laps -> ${response.status()} ${JSON.stringify(body?.laps ?? null)}`);
    } else {
      lapGets.push({ status: response.status(), url });
      log(`TV GET ${url.replace(HTTP, '')} -> ${response.status()}`);
    }
  });

  // ---- Lobby: three pads with their modes, plus one keyboard player --------------------------
  const pads = [];
  for (const [i, p] of PLAYERS.entries()) {
    const { pad, cdp } = await L.openPad(browser, code, `pad${p.key}`);
    await pad.fill('#pad-name', p.name);
    await pad.click(`button[aria-label^="${p.colour}"]`);
    if (p.mode === 'buttons') await pad.click('button.pad-mode:nth-child(2)');
    const picked = await pad.$$eval('button.pad-mode', (els) =>
      els.map((e) => e.getAttribute('aria-checked')),
    );
    check(
      2,
      picked[p.mode === 'buttons' ? 1 : 0] === 'true',
      `pad ${p.key} (${p.name}) joins in ${p.mode === 'drag' ? 'Drag steer' : 'Buttons'}`,
    );
    await pad.click('button.pad-btn--big');
    await pad.waitForSelector('.pad-ready', { timeout: 60000 });
    pads.push({ ...p, i, pad, cdp });
  }
  await tv.keyboard.press('KeyK');
  const four = await poll(
    () => tv.$$eval('.slot:not(.slot--empty)', (els) => els.length === 4),
    30000,
  );
  check(2, four, 'TV lobby has 4 players (3 pads + 1 keyboard)');
  await tv.keyboard.press('Enter');
  await sleep(800);
  await tv.screenshot({ path: `${L.OUT}/${L.TAG}-lobby.png` });
  await tv.setViewportSize(L.SMALL);
  for (const p of pads) await p.pad.click('.pad-ready');

  const loadS = await L.waitGameLoaded(tv);
  log(`TV game loaded in ${loadS} s`);
  for (const p of pads) await p.pad.waitForSelector('.ctl', { timeout: 60000 });
  check(2, (await tv.$$('.sw-hud')).length === 4, '4 viewports on the TV');
  for (const p of pads) {
    check(2, Boolean(await p.pad.$(`.ctl--${p.mode}`)), `pad ${p.key} controller opens in ${p.mode}`);
  }
  const green = await L.waitGreen(tv);
  check(2, green, 'race went green');
  await tv.keyboard.press('Backquote');
  await sleep(1000);
  const slotsBefore = await huds(tv);
  log('viewports:', JSON.stringify(slotsBefore.map((h) => `${h.name} ${h.colour}`)));

  // ---- Touch helpers ---------------------------------------------------------------------------
  const touch = (p, type, points) =>
    p.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const release = async (p) => {
    await touch(p, 'touchEnd', []);
    await sleep(300);
  };
  const row = (p) => overlay(tv, p.name);
  const waitRow = (name, pred, ms) =>
    poll(async () => {
      const o = await overlay(tv, name);
      return o && pred(o) ? o : null;
    }, ms, 300);

  /** Hold gas and steer right (drag) or the given arrow (buttons) until the TV overlay shows it. */
  async function driveByTouch(p, mode, dir = 1) {
    const gas = await rect(p.pad, '[data-zone="gas"]');
    if (mode === 'buttons') {
      const arrow = await rect(p.pad, dir > 0 ? '[data-zone="right"]' : '[data-zone="left"]');
      await touch(p, 'touchStart', [
        { x: arrow.cx, y: arrow.cy, id: 1 },
        { x: gas.cx, y: gas.cy, id: 2 },
      ]);
    } else {
      const steer = await rect(p.pad, '.ctl-steer');
      const start = { x: steer.cx, y: steer.cy, id: 1 };
      await touch(p, 'touchStart', [start, { x: gas.cx, y: gas.cy, id: 2 }]);
      for (let k = 1; k <= 5; k++) {
        await touch(p, 'touchMove', [
          { ...start, x: start.x + (dir * 0.25 * L.PAD_SIZE.height * k) / 5 },
          { x: gas.cx, y: gas.cy, id: 2 },
        ]);
        await sleep(40);
      }
    }
    const seen = await waitRow(
      p.name,
      (o) => o.gas === 1 && o.steer * dir > (mode === 'buttons' ? 0.9 : 0.5),
      90000,
    );
    return seen;
  }

  // ---- Item 2: each pad drives by touch; the keyboard player drives ---------------------------
  for (const p of pads) {
    const seen = await driveByTouch(p, p.mode);
    check(2, seen, `pad ${p.key} ${p.mode}: steer and gas reach the TV overlay (${seen ? seen.line : 'timeout'})`);
    if (p.key === 'A') await padShot(p.pad, 'pad-A-drag');
    if (p.key === 'B') await padShot(p.pad, 'pad-B-buttons');
    await release(p);
  }
  await tv.keyboard.down('KeyW');
  const keys = await waitRow(KEYS, (o) => o.gas === 1, 60000);
  check(2, keys, `keyboard player: W reaches the TV overlay (${keys ? keys.line : 'timeout'})`);
  await tv.keyboard.up('KeyW');

  // Pad C switches from Drag steer to Buttons in Settings mid-race, then drives with the arrows.
  const padC = pads[2];
  await padC.pad.click('.ctl-settings');
  await padC.pad.waitForSelector('.pad-sheet', { timeout: 15000 });
  await padC.pad.click('.pad-sheet button.pad-mode:nth-child(2)');
  await padC.pad.click('.pad-sheet .pad-btn:not(.pad-btn--ghost)');
  const switched = await poll(() => padC.pad.$('.ctl--buttons'), 15000);
  check(2, switched, 'pad C switched from Drag steer to Buttons in Settings mid-race');
  if (switched) {
    const seen = await driveByTouch(padC, 'buttons', -1);
    check(2, seen, `pad C after the switch: left arrow and gas reach the TV (${seen ? seen.line : 'timeout'})`);
    await padShot(padC.pad, 'pad-C-switched');
    await release(padC);
  }
  await tvShot(tv, 'race-4p');

  // ---- Item 4: reload pad B mid-race -----------------------------------------------------------
  const padB = pads[1];
  const beforeB = await hudFor(tv, padB.name);
  const accentBefore = await padB.pad.$eval('.ctl', (e) => e.style.getPropertyValue('--accent'));
  log(`pad B before reload: viewport ${beforeB?.index} colour ${beforeB?.colour} accent ${accentBefore}`);
  await padB.pad.reload();
  // A reloaded page has lost its in-memory join, so it shows the join screen filled in from the
  // saved profile and the player taps JOIN once (same tab id, so the TV gives back the same car).
  // If a later build rejoins by itself, the controller simply appears and no tap is needed.
  const screen = await poll(
    async () => ((await padB.pad.$('.ctl')) ? 'controller' : (await padB.pad.$('#pad-name')) ? 'join' : null),
    120000,
    1000,
  );
  log(`pad B after reload shows: ${screen ?? 'nothing'}`);
  if (screen === 'join') {
    await sleep(1500);
    const prefilled = await padB.pad.$eval('#pad-name', (e) => e.value);
    const modeOn = await padB.pad.$$eval('button.pad-mode', (els) => els.map((e) => e.getAttribute('aria-checked')));
    check(4, prefilled === padB.name && modeOn[1] === 'true', `pad B join screen after reload is filled in: name "${prefilled}", Buttons selected ${modeOn[1]}`);
    await padB.pad.click('button.pad-btn--big');
    log('NOTE pad B needed one JOIN tap after the reload (no automatic rejoin on a page reload)');
  }
  const back = await poll(() => padB.pad.$('.ctl'), 120000, 1000);
  check(4, back, `pad B reloaded mid-race and shows its controller again${screen === 'join' ? ' (after one JOIN tap)' : ' (no tap needed)'}`);
  padB.cdp = await padB.pad.context().newCDPSession(padB.pad);
  const afterB = await hudFor(tv, padB.name);
  const allAfter = await huds(tv);
  check(
    4,
    beforeB && afterB && afterB.index === beforeB.index && afterB.colour === beforeB.colour && allAfter.length === 4,
    `pad B is the same car: viewport ${afterB?.index} (was ${beforeB?.index}), colour ${afterB?.colour} (was ${beforeB?.colour}), ${allAfter.length} viewports`,
  );
  const accentAfter = await padB.pad.$eval('.ctl', (e) => e.style.getPropertyValue('--accent')).catch(() => '');
  check(4, accentAfter && accentAfter === accentBefore, `pad B controller keeps its colour (${accentAfter})`);
  check(4, Boolean(await padB.pad.$('.ctl--buttons')), 'pad B is still in Buttons after the reload');
  const connected = await waitRow(padB.name, (o) => o.connected, 60000);
  check(4, connected, `TV overlay shows pad B connected (${connected ? connected.line : 'lost'})`);
  const drivesAgain = await driveByTouch(padB, 'buttons');
  check(4, drivesAgain, `pad B drives again after the reload (${drivesAgain ? drivesAgain.line : 'timeout'})`);
  await release(padB);

  // R chip: hold BRAKE·R; it brakes to a standstill, then arms reverse (pad chip + TV chip).
  const brake = await rect(padB.pad, '[data-zone="brake"]');
  await touch(padB, 'touchStart', [{ x: brake.cx, y: brake.cy + brake.h * 0.2, id: 5 }]);
  const rOn = await poll(async () => {
    const label = await padB.pad.$eval('.ctl-brake strong', (e) => e.textContent);
    const chip = await padB.pad.$('.ctl-rchip[data-on]');
    return label === 'REVERSE' && chip ? label : null;
  }, 120000);
  check(4, rOn, 'pad B after reload: holding BRAKE·R at a standstill lights the R chip (label REVERSE)');
  const tvGear = await poll(async () => (await hudFor(tv, padB.name))?.gear, 30000);
  check(4, tvGear, 'TV HUD shows the R chip for pad B');
  if (rOn) await padShot(padB.pad, 'pad-B-reverse');
  await release(padB);
  const rOff = await poll(async () => !(await padB.pad.$('.ctl-rchip[data-on]')), 30000);
  check(4, rOff, 'pad B: releasing BRAKE·R turns the R chip off');

  // Stuck hint: hold GAS and an arrow into the barrier until the hint shows on pad B.
  let hint = '';
  for (const dir of [1, -1]) {
    await tv.keyboard.press('KeyN');
    await sleep(2000);
    const gas = await rect(padB.pad, '[data-zone="gas"]');
    const arrow = await rect(padB.pad, dir > 0 ? '[data-zone="right"]' : '[data-zone="left"]');
    await touch(padB, 'touchStart', [
      { x: arrow.cx, y: arrow.cy, id: 6 },
      { x: gas.cx, y: gas.cy, id: 7 },
    ]);
    hint = await poll(() => padB.pad.$eval('.ctl-hint', (e) => e.textContent).catch(() => ''), 120000, 500);
    if (hint) break;
    log(`no stuck hint steering ${dir > 0 ? 'right' : 'left'}; trying the other way`);
    await release(padB);
  }
  check(4, hint, `pad B after reload: stuck hint shows ("${hint}")`);
  const tvHint = await poll(async () => (await hudFor(tv, padB.name))?.hint, 15000);
  check(4, tvHint, `TV HUD shows the stuck hint for pad B ("${tvHint || ''}")`);
  if (hint) await padShot(padB.pad, 'pad-B-hint');
  await release(padB);
  const cleared = await poll(() => padB.pad.$eval('.ctl-hint', () => false).catch(() => true), 30000);
  log(`pad B hint cleared after letting go: ${Boolean(cleared)} (informational)`);

  // ---- Autopilot finishes the race --------------------------------------------------------------
  await tv.keyboard.press('KeyN');
  await sleep(1000);
  await tv.keyboard.press('KeyP');
  log('autopilot on');
  const raceStart = Date.now();
  let midShot = false;
  while (Date.now() - raceStart < RACE_MIN * 60000) {
    await sleep(30000);
    if (await tv.$('.sw-results')) break;
    const rows = await Promise.all([...pads.map((p) => row(p)), overlay(tv, KEYS)]);
    log(rows.map((r) => (r ? r.line : '-')).join(' | '));
    if (!midShot && rows.some((r) => r && r.lap >= 2)) {
      midShot = true;
      await tvShot(tv, 'race-lap2');
      await padShot(pads[0].pad, 'pad-A-race');
    }
  }
  const finished = Boolean(await tv.$('.sw-results'));
  check(2, finished, `autopilot finished the full race (${((Date.now() - raceStart) / 60000).toFixed(1)} min)`);
  if (!finished) {
    await tvShot(tv, 'race-timeout');
    L.finish('int-race');
    await browser.close();
    return;
  }

  // ---- Item 3: lap records ------------------------------------------------------------------------
  const resultRows = await tv.$$eval('.sw-results-list li', (els) =>
    els.map((e) => e.innerText.replace(/\s+/g, ' ')),
  );
  log('results:', JSON.stringify(resultRows));
  check(2, resultRows.length === 4, `results list has 4 drivers (${resultRows.length})`);
  await poll(
    () => tv.$eval('.sw-results-board', (e) => !/Loading/.test(e.innerText)),
    60000,
  );
  await sleep(2000);
  const post = lapPosts.at(-1);
  if (!post) {
    log(`no POST /api/laps: laps under MIN_LAP_MS (45 s) are not posted; best laps above`);
  }
  check(3, post && post.status === 200, `TV POST /api/laps returned ${post ? post.status : 'nothing (no POST seen)'}`);
  const posted = post?.body?.laps ?? [];
  const get = await fetch(`${HTTP}/api/laps?track=kestrel-pines`);
  const board = get.ok ? await get.json() : { entries: [] };
  log(`GET /api/laps?track=kestrel-pines -> ${get.status}: ${JSON.stringify(board.entries)}`);
  const inGet = posted.filter((lap) =>
    board.entries.some(
      (e) => e.name.toLowerCase() === lap.name.toLowerCase() && e.bestLapMs <= lap.bestLapMs,
    ),
  );
  check(
    3,
    get.status === 200 && posted.length > 0 && inGet.length === posted.length,
    `GET /api/laps?track=kestrel-pines returns the ${posted.length} posted entries (${inGet.length} found)`,
  );
  const boardText = await tv.$eval('.sw-results-board', (e) => e.innerText.replace(/\s+/g, ' '));
  log('board:', boardText);
  const top8 = board.entries.slice(0, 8);
  const expectOnBoard = posted.filter((lap) =>
    top8.some((e) => e.name.toLowerCase() === lap.name.toLowerCase()),
  );
  const missing = expectOnBoard.filter((lap) => {
    const entry = top8.find((e) => e.name.toLowerCase() === lap.name.toLowerCase());
    return !boardText.includes(entry.name) || !boardText.includes(L.formatTime(entry.bestLapMs));
  });
  check(
    3,
    expectOnBoard.length > 0 && missing.length === 0,
    `.sw-results-board lists the posted entries (${expectOnBoard.length - missing.length}/${expectOnBoard.length} in the top 8 shown)`,
  );
  check(3, /Kestrel Pines/i.test(boardText), 'results board is titled for Kestrel Pines');
  await tv.keyboard.press('Backquote');
  await tvShot(tv, 'results-board');
  await tv.setViewportSize(L.BIG);

  // ---- Item 5: play-again vote --------------------------------------------------------------------
  for (const p of pads) await p.pad.waitForSelector('.pad-results', { timeout: 60000 });
  await padShot(pads[0].pad, 'pad-A-results');
  await pads[0].pad.click('.pad-ready');
  const voteLine = await poll(
    () => tv.$eval('.sw-results-vote', (e) => (/1\/2/.test(e.innerText) ? e.innerText : null)),
    30000,
  );
  check(5, voteLine, `TV counts the first vote ("${voteLine || ''}")`);
  await pads[1].pad.click('.pad-ready');
  const lobby = await poll(() => tv.$('.lobby'), 60000);
  check(5, lobby, 'majority vote returns the TV to the lobby');
  let padsBack = 0;
  for (const p of pads) {
    if (await poll(() => p.pad.$('.pad-lobby'), 60000)) padsBack += 1;
  }
  check(5, padsBack === 3, `all 3 pads back in the lobby (${padsBack}/3)`);
  await sleep(1000);
  await tv.screenshot({ path: `${L.OUT}/${L.TAG}-lobby-after-vote.png` });

  log(`total ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  L.finish('int-race');
  await browser.close();
})().catch((e) => {
  console.error('FAIL [script] crashed:', e);
  for (const x of L.errors) console.error('   pageerror', x);
  process.exit(1);
});
