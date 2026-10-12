// Focused copy of int-race.cjs item 4 for the auto-rejoin fix (branch m8/fix-rejoin).
// TV + pads A (Drag steer), B (Buttons), C (same name as B). Checks, all hard FAILs:
//  - lobby: pad B reloads and is back in the lobby with NO tap (the join screen must never show),
//    same slot and colour on the TV and on the phone; C (same name) is untouched;
//  - explicit leave: C taps Settings > Leave room, the TV frees the seat at once, a reload of C
//    stays out of the room;
//  - lobby start hold: B is ready and reloads, A readies while B is away; the TV must stay in the
//    lobby until B is back, then start with both cars;
//  - countdown: pad B reloads as the race loads into its countdown and gets its controller back;
//  - race: pad B reloads mid-race and is back as the same car with NO tap: same viewport, same
//    colour on the TV and the phone, still Buttons, connected, and its controls drive the car;
//  - podium/results: the race is finished (debug N + autopilot); pad B reloads on the results screen
//    and gets the full standings board back, same place and colour, and its vote counts;
//  - no pageerror anywhere.
// Usage: node rejoin.cjs <httpPort> <httpsPort>
const L = require('./lib.cjs');
const { sleep, log, check, poll, overlay, huds, hudFor, rect, tvShot, padShot } = L;

const RUN = Math.random().toString(36).slice(2, 5);
const PLAYERS = [
  { key: 'A', name: `Ava ${RUN}`, colour: 'Lagoon', mode: 'drag' },
  { key: 'B', name: `Ben ${RUN}`, colour: 'Taxi', mode: 'buttons' },
  { key: 'C', name: `Ben ${RUN}`, colour: 'Flamingo', mode: 'drag' },
];

/** TV lobby slots: number, name, colour, connected. */
function tvSlots(tv) {
  return tv.$$eval('.slot:not(.slot--empty)', (els) =>
    els.map((el) => ({
      num: el.querySelector('.slot-number')?.textContent ?? '',
      name: el.querySelector('.slot-name')?.textContent ?? '',
      colour: el.style.getPropertyValue('--slot-colour').trim(),
      connected: Boolean(el.querySelector('.slot-dot.is-connected')),
    })),
  );
}

/**
 * Reloads a pad and waits until `doneSelector` shows. Watches the whole time for the join screen
 * (#pad-name): auto-rejoin means it must never appear. Returns { done, sawJoin, ms }.
 */
async function reloadAndWatch(pad, doneSelector, timeoutMs = 120000) {
  const t0 = Date.now();
  await pad.reload({ waitUntil: 'commit' });
  let sawJoin = false;
  let done = false;
  while (Date.now() - t0 < timeoutMs) {
    const state = await pad
      .evaluate(
        (sel) => ({
          join: Boolean(document.querySelector('#pad-name')),
          done: Boolean(document.querySelector(sel)),
          title: document.querySelector('h1')?.textContent ?? '',
        }),
        doneSelector,
      )
      .catch(() => null);
    if (state?.join) sawJoin = true;
    if (state?.done) {
      done = true;
      break;
    }
    await sleep(100);
  }
  return { done, sawJoin, ms: Date.now() - t0 };
}

(async () => {
  const t0 = Date.now();
  const browser = await L.launch();
  const { tv, code } = await L.openTv(browser);
  log('room', code, 'run tag', RUN);

  // ---- Lobby: three fresh phones each see the join screen and join -----------------------------
  const pads = [];
  for (const p of PLAYERS) {
    const { pad, cdp } = await L.openPad(browser, code, `pad${p.key}`); // waits for #pad-name
    check(4, true, `fresh pad ${p.key} shows the join screen`);
    await pad.fill('#pad-name', p.name);
    await pad.click(`button[aria-label^="${p.colour}"]`);
    if (p.mode === 'buttons') await pad.click('button.pad-mode:nth-child(2)');
    await pad.click('button.pad-btn--big');
    await pad.waitForSelector('.pad-ready', { timeout: 60000 });
    pads.push({ ...p, pad, cdp });
  }
  const [padA, padB, padC] = pads;
  await poll(async () => (await tvSlots(tv)).length === 3, 30000);
  const lobbyBefore = await tvSlots(tv);
  log('TV lobby before:', JSON.stringify(lobbyBefore));
  const lobbyAccentB = await padB.pad.$eval('.pad-lobby', (e) => e.style.getPropertyValue('--accent'));

  // ---- Lobby reload of pad B ----------------------------------------------------------------------
  const lobbyReload = await reloadAndWatch(padB.pad, '.pad-ready');
  check(4, lobbyReload.done, `lobby: pad B is back in the lobby after a reload (${lobbyReload.ms} ms)`);
  check(4, !lobbyReload.sawJoin, 'lobby: pad B never showed the join screen (no tap needed)');
  await sleep(1500);
  const lobbyAfter = await tvSlots(tv);
  log('TV lobby after:', JSON.stringify(lobbyAfter));
  check(
    4,
    JSON.stringify(lobbyAfter) === JSON.stringify(lobbyBefore),
    'lobby: TV slots identical after the reload (same slots, names, colours, 3 players, no duplicate)',
  );
  const lobbyAccentAfter = await padB.pad.$eval('.pad-lobby', (e) => e.style.getPropertyValue('--accent'));
  check(4, lobbyAccentAfter === lobbyAccentB, `lobby: pad B keeps its colour (${lobbyAccentAfter}, was ${lobbyAccentB})`);
  await padShot(padB.pad, 'pad-B-lobby-after-reload');

  // ---- Explicit leave (pad C, same name as B) ----------------------------------------------------
  await padC.pad.click('.pad-icon-btn[aria-label="Settings"]');
  await padC.pad.waitForSelector('.pad-sheet', { timeout: 15000 });
  const leaveT0 = Date.now();
  await padC.pad.click('.pad-sheet button:has-text("Leave room")');
  const codeEntry = await poll(() => padC.pad.$('#room-code'), 15000, 200);
  check(4, codeEntry, 'leave: pad C is back at the room code screen');
  const freed = await poll(async () => (await tvSlots(tv)).length === 2, 10000, 200);
  check(4, freed, `leave: TV freed pad C's seat at once (${Date.now() - leaveT0} ms, grace is 15 s)`);
  const lobbyLeft = await tvSlots(tv);
  check(
    4,
    lobbyLeft.some((s) => s.name === padB.name && s.colour === lobbyBefore.find((b) => b.num === 'P2')?.colour),
    'leave: pad B (same name) keeps its seat and colour',
  );
  await padC.pad.reload();
  await sleep(4000);
  const cAfter = await padC.pad.evaluate(() => ({
    code: Boolean(document.querySelector('#room-code')),
    ctl: Boolean(document.querySelector('.pad-ready, .ctl')),
  }));
  check(4, cAfter.code && !cAfter.ctl, 'leave: reloading pad C after leaving does not rejoin');
  check(4, (await tvSlots(tv)).length === 2, 'leave: TV still has 2 players');

  // ---- Lobby start hold: B ready, B reloads, A readies while B is away ----------------------------
  await tv.setViewportSize(L.SMALL);
  await padB.pad.click('.pad-ready');
  await poll(
    async () => (await tv.$$eval('.slot-status, .slot', (els) => els.map((e) => e.textContent).join('|'))).includes('Ready'),
    15000,
    200,
  );
  const holdReload = reloadAndWatch(padB.pad, '.pad-ready, .ctl');
  const away = await poll(async () => {
    const slots = await tvSlots(tv);
    return slots.find((s) => s.name === padB.name && !s.connected) ? true : null;
  }, 15000, 50);
  check(4, away, 'hold: TV shows pad B away while it reloads');
  await padA.pad.click('.pad-ready');
  await sleep(400);
  const heldHint = await tv.$eval('.lobby-hint', (e) => e.textContent).catch(() => '');
  const stillLobby = Boolean(await tv.$('.lobby')) && !(await tv.$('.sw-stage'));
  const bStillAway = (await tvSlots(tv)).some((s) => s.name === padB.name && !s.connected);
  log(`hold: TV hint while B is away: "${heldHint}"`);
  check(4, bStillAway, 'hold: pad B was still away 400 ms after A pressed ready (the check below is meaningful)');
  check(4, stillLobby, 'hold: the race did not start while pad B was reloading (both had pressed ready)');
  check(4, /reconnect/i.test(heldHint), 'hold: TV lobby says it is waiting for pad B to reconnect');
  const holdBack = await holdReload;
  check(4, holdBack.done && !holdBack.sawJoin, `hold: pad B came back with no tap (${holdBack.ms} ms)`);

  // ---- Race ---------------------------------------------------------------------------------------
  // B kept its ready flag through the reload, so the race starts on its own once B is back.
  const loadS = await L.waitGameLoaded(tv);
  log(`TV game loaded in ${loadS} s`);
  check(4, (await tv.$$('.sw-hud')).length === 2, 'hold: the race started with both cars once pad B was back');

  // ---- Countdown reload ---------------------------------------------------------------------------
  // The loading screen goes when the countdown starts (prepare() -> start()).
  const accentPre = await padB.pad
    .waitForSelector('.ctl', { timeout: 60000 })
    .then(() => padB.pad.$eval('.ctl', (e) => e.style.getPropertyValue('--accent')));
  const cdReloadT0 = Date.now();
  const cdState = { countdownAfter: false };
  const cdWatch = (async () => {
    while (Date.now() - cdReloadT0 < 60000) {
      const seen = await padB.pad.$('.ctl-countdown').catch(() => null);
      if (seen && Date.now() - cdReloadT0 > 300) {
        cdState.countdownAfter = true;
        return;
      }
      await sleep(50);
    }
  })();
  const cdReload = await reloadAndWatch(padB.pad, '.ctl');
  check(4, cdReload.done, `countdown: pad B shows its controller again after a reload at the countdown (${cdReload.ms} ms)`);
  check(4, !cdReload.sawJoin, 'countdown: pad B never showed the join screen');
  const accentCd = await padB.pad.$eval('.ctl', (e) => e.style.getPropertyValue('--accent')).catch(() => '');
  check(4, accentCd && accentCd === accentPre, `countdown: phone colour identical (${accentCd}, was ${accentPre})`);
  await sleep(1500);
  log(`countdown: pad B showed the countdown digits after its reload: ${cdState.countdownAfter} (informational: the countdown is 3 s)`);
  await cdWatch.catch(() => undefined);
  padB.cdp = await padB.pad.context().newCDPSession(padB.pad);
  for (const p of [padA, padB]) await p.pad.waitForSelector('.ctl', { timeout: 60000 });
  const green = await L.waitGreen(tv);
  check(4, green, 'race went green');
  await tv.keyboard.press('Backquote');
  await sleep(1000);

  const touch = (p, type, points) => p.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const release = async (p) => {
    await touch(p, 'touchEnd', []);
    await sleep(300);
  };
  const waitRow = (name, pred, ms) =>
    poll(async () => {
      const o = await overlay(tv, name);
      return o && pred(o) ? o : null;
    }, ms, 300);
  async function driveButtons(p, dir = 1) {
    const gas = await rect(p.pad, '[data-zone="gas"]');
    const arrow = await rect(p.pad, dir > 0 ? '[data-zone="right"]' : '[data-zone="left"]');
    await touch(p, 'touchStart', [
      { x: arrow.cx, y: arrow.cy, id: 1 },
      { x: gas.cx, y: gas.cy, id: 2 },
    ]);
    return waitRow(p.name, (o) => o.gas === 1 && o.steer * dir > 0.9, 90000);
  }

  const before = await driveButtons(padB);
  check(4, before, `pad B drives before the reload (${before ? before.line : 'timeout'})`);
  await release(padB);
  await padShot(padB.pad, 'pad-B-before-reload');

  // ---- Item 4: reload pad B mid-race, no tap allowed ----------------------------------------------
  const hudBefore = await hudFor(tv, padB.name);
  const accentBefore = await padB.pad.$eval('.ctl', (e) => e.style.getPropertyValue('--accent'));
  log(`pad B before reload: viewport ${hudBefore?.index} colour ${hudBefore?.colour} accent ${accentBefore}`);
  const raceReload = await reloadAndWatch(padB.pad, '.ctl');
  check(4, raceReload.done, `race: pad B shows its controller again after the reload (${raceReload.ms} ms)`);
  check(4, !raceReload.sawJoin, 'race: pad B never showed the join screen (no JOIN tap needed)');
  padB.cdp = await padB.pad.context().newCDPSession(padB.pad);
  const hudAfter = await hudFor(tv, padB.name);
  const allAfter = await huds(tv);
  check(
    4,
    hudBefore && hudAfter && hudAfter.index === hudBefore.index && hudAfter.colour === hudBefore.colour && allAfter.length === 2,
    `race: pad B is the same car: viewport ${hudAfter?.index} (was ${hudBefore?.index}), TV colour ${hudAfter?.colour} (was ${hudBefore?.colour}), ${allAfter.length} viewports`,
  );
  const accentAfter = await padB.pad.$eval('.ctl', (e) => e.style.getPropertyValue('--accent')).catch(() => '');
  check(4, accentAfter && accentAfter === accentBefore, `race: phone colour identical (${accentAfter}, was ${accentBefore})`);
  check(
    4,
    accentAfter && hudAfter && accentAfter.toLowerCase() === hudAfter.colour.toLowerCase(),
    `race: phone colour matches the TV car colour (${accentAfter} vs ${hudAfter?.colour})`,
  );
  check(4, Boolean(await padB.pad.$('.ctl--buttons')), 'race: pad B is still in Buttons after the reload');
  const connected = await waitRow(padB.name, (o) => o.connected, 60000);
  check(4, connected, `race: TV overlay shows pad B connected (${connected ? connected.line : 'lost'})`);
  const t1 = Date.now();
  const drives = await driveButtons(padB, -1);
  check(4, drives, `race: pad B drives again after the reload, left arrow + gas (${drives ? drives.line : 'timeout'}, ${Date.now() - t1} ms)`);
  await padShot(padB.pad, 'pad-B-after-reload');
  await release(padB);
  await tvShot(tv, 'tv-after-reload');
  const hudA = await hudFor(tv, padA.name);
  check(4, hudA && hudA.index !== hudAfter?.index, `pad A keeps its own car (viewport ${hudA?.index})`);

  // ---- Finish the race: autopilot plus the debug gate skip (N) -------------------------------------
  await tv.keyboard.press('KeyP');
  const finishT0 = Date.now();
  while (Date.now() - finishT0 < 600000 && !(await tv.$('.sw-results'))) {
    await tv.keyboard.press('KeyN');
    await sleep(1200);
  }
  const podium = Boolean(await tv.$('.sw-results'));
  check(4, podium, `podium: race finished and the TV shows results (${Math.round((Date.now() - finishT0) / 1000)} s)`);
  const resultsBefore = await poll(
    () =>
      padB.pad
        .evaluate(() => {
          const rows = [...document.querySelectorAll('.pad-results-list li')].map((e) => e.innerText.replace(/\s+/g, ' '));
          if (rows.length === 0) return null;
          return {
            rows,
            me: document.querySelector('.pad-results-me strong')?.textContent ?? '',
            accent: document.querySelector('.pad-results')?.style.getPropertyValue('--accent') ?? '',
          };
        })
        .catch(() => null),
    60000,
    300,
  );
  log('pad B results before reload:', JSON.stringify(resultsBefore));
  check(4, resultsBefore && resultsBefore.rows.length === 2, 'podium: pad B shows the 2-row results board');
  await padShot(padB.pad, 'pad-B-results-before-reload');

  const resReload = await reloadAndWatch(padB.pad, '.pad-results-list li');
  check(4, resReload.done, `results: pad B gets the standings board back after a reload (${resReload.ms} ms)`);
  check(4, !resReload.sawJoin, 'results: pad B never showed the join screen');
  const resultsAfter = await padB.pad
    .evaluate(() => ({
      rows: [...document.querySelectorAll('.pad-results-list li')].map((e) => e.innerText.replace(/\s+/g, ' ')),
      me: document.querySelector('.pad-results-me strong')?.textContent ?? '',
      accent: document.querySelector('.pad-results')?.style.getPropertyValue('--accent') ?? '',
    }))
    .catch(() => null);
  log('pad B results after reload:', JSON.stringify(resultsAfter));
  check(
    4,
    resultsBefore && resultsAfter && JSON.stringify(resultsAfter) === JSON.stringify(resultsBefore),
    'results: same standings, same place for B, same colour after the reload',
  );
  await padShot(padB.pad, 'pad-B-results-after-reload');

  // Both vote: the reloaded pad's vote counts and everyone is back in the lobby in their seats.
  await padB.pad.click('.pad-results .pad-ready');
  await padA.pad.click('.pad-results .pad-ready');
  const backInLobby = await poll(async () => (await tv.$('.lobby-code')) && !(await tv.$('.sw-canvas')), 30000, 300);
  check(4, backInLobby, 'results: both votes (one from the reloaded pad) take the TV back to the lobby');
  const lobbyEnd = await tvSlots(tv);
  log('TV lobby at the end:', JSON.stringify(lobbyEnd));
  check(
    4,
    lobbyEnd.length === 2 && lobbyEnd.every((s) => s.connected) && lobbyEnd.find((s) => s.name === padB.name)?.colour === lobbyBefore.find((b) => b.num === 'P2')?.colour,
    'results: both phones back in the lobby, pad B in its colour',
  );

  log(`total ${Math.round((Date.now() - t0) / 1000)} s`);
  L.finish('rejoin.cjs');
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  process.exit(1);
});
