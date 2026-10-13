// C4 acceptance (spec 2.6): car select on the phone, TV lobby slots, reconnect keeps car and paint.
// Usage: flock /tmp/claude-0/cars-browser.lock node select.cjs 5300 5743
const L = require('./lib.cjs');
const { sleep, log, check, poll, rect, padShot } = L;

const RECORD = () => {
  window.__msgs = [];
  const parse = JSON.parse;
  JSON.parse = function (...args) {
    const value = parse.apply(this, args);
    if (value && typeof value === 'object' && (value.type === 'lobby' || value.type === 'joined')) {
      window.__msgs.push(value);
    }
    return value;
  };
};

const PORTRAIT = { width: 390, height: 844 };

async function openPad(browser, code, tag) {
  const ctx = await browser.newContext({ viewport: L.PAD_SIZE, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  await ctx.addInitScript(RECORD);
  const pad = await ctx.newPage();
  L.watch(pad, tag);
  await pad.goto(`${L.HTTPS}/pad?room=${code}`);
  await pad.waitForSelector('#pad-name', { timeout: 90000 });
  const cdp = await ctx.newCDPSession(pad);
  return { pad, ctx, cdp };
}

function tvSlots(tv) {
  return tv.$$eval('.slot:not(.slot--empty)', (els) =>
    els.map((el) => ({
      name: el.querySelector('.slot-name')?.textContent ?? '',
      car: el.querySelector('.slot-car')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
      paint: el.querySelector('.slot-thumb')?.style.getPropertyValue('--paint').trim() ?? '',
      colour: el.style.getPropertyValue('--slot-colour').trim(),
      thumb: Boolean(el.querySelector('.slot-thumb svg, .slot-thumb img')),
      connected: Boolean(el.querySelector('.slot-dot.is-connected')),
    })),
  );
}

const model = (pad) => pad.$eval('.car-title strong', (e) => e.textContent.trim()).catch(() => '');

async function pickCar(pad, name) {
  for (let i = 0; i < 6 && !(await model(pad)).endsWith(name); i++) {
    await pad.click('button[aria-label="Next car"]');
    await sleep(150);
  }
  return (await model(pad)).endsWith(name);
}

/** Fits on screen without scrolling, with the Join button fully visible. */
async function fits(pad) {
  return pad.evaluate(() => {
    const s = document.querySelector('.pad-screen');
    const b = document.querySelector('.pad-join-submit .pad-btn--big').getBoundingClientRect();
    return {
      scroll: s.scrollHeight - s.clientHeight,
      join: b.top >= 0 && b.bottom <= innerHeight && b.right <= innerWidth,
      overflowX: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

async function reloadAndWatch(pad, doneSelector, timeoutMs = 120000) {
  const t0 = Date.now();
  await pad.reload({ waitUntil: 'commit' });
  let sawJoin = false;
  let done = false;
  while (Date.now() - t0 < timeoutMs) {
    const st = await pad
      .evaluate((sel) => ({ join: Boolean(document.querySelector('#pad-name')), done: Boolean(document.querySelector(sel)) }), doneSelector)
      .catch(() => null);
    if (st?.join) sawJoin = true;
    if (st?.done) {
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
  log('room', code);

  // ---- 1. Pad A: Sara, Haymaker, red, Drag --------------------------------------------------------
  const A = await openPad(browser, code, 'padA');
  await A.pad.fill('#pad-name', 'Sara');
  check(1, await pickCar(A.pad, 'Haymaker'), 'pad A picks the Haymaker with the arrows');
  await A.pad.click('button[aria-label^="Inferno"]');
  const fitA = await fits(A.pad);
  check(1, fitA.scroll <= 0 && fitA.join && fitA.overflowX <= 0, `landscape join fits 844x390 without scrolling, Join visible (${JSON.stringify(fitA)})`);
  await padShot(A.pad, 'padA-join-landscape');
  await A.pad.click('button.pad-btn--big');
  await A.pad.waitForSelector('.pad-ready', { timeout: 60000 });

  // ---- Pad B: swipes to the Haymaker, red is taken, picks blue ------------------------------------
  const B = await openPad(browser, code, 'padB');
  await B.pad.fill('#pad-name', 'Ben');
  // Swipe left twice on the card (pointer events from touch).
  for (let i = 0; i < 2; i++) {
    const r = await rect(B.pad, '.car-stage-frame');
    await B.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.cx + 60, y: r.cy, id: 1 }] });
    for (let k = 1; k <= 5; k++) {
      await B.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.cx + 60 - k * 24, y: r.cy, id: 1 }] });
    }
    await B.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(400);
  }
  const swiped = await model(B.pad);
  check(1, swiped.endsWith('Haymaker'), `pad B swipes twice to the Haymaker (${swiped})`);
  if (!swiped.endsWith('Haymaker')) await pickCar(B.pad, 'Haymaker');
  const also = await B.pad.$eval('.car-also', (e) => e.textContent).catch(() => '');
  check(1, /Sara/.test(also), `pad B's card says who else drives it ("${also}")`);
  const redDisabled = await B.pad.$eval('button[aria-label^="Inferno"]', (e) => e.disabled);
  check(1, redDisabled, 'red (Inferno) is disabled on pad B');
  await B.pad.click('button[aria-label^="Electric"]');
  await padShot(B.pad, 'padB-join-landscape');
  await B.pad.setViewportSize(PORTRAIT);
  await sleep(600);
  const fitB = await fits(B.pad);
  check(1, fitB.join && fitB.overflowX <= 0, `portrait join: Join visible (sticky), no sideways overflow (${JSON.stringify(fitB)})`);
  await padShot(B.pad, 'padB-join-portrait');
  await B.pad.evaluate(() => document.querySelector('.pad-screen').scrollTo(0, 10000));
  await sleep(300);
  await padShot(B.pad, 'padB-join-portrait-scrolled');
  await B.pad.setViewportSize(L.PAD_SIZE);
  await sleep(300);
  await B.pad.click('button.pad-btn--big');
  await B.pad.waitForSelector('.pad-ready', { timeout: 60000 });

  await poll(async () => (await tvSlots(tv)).length === 2, 30000);
  let slots = await tvSlots(tv);
  log('TV slots:', JSON.stringify(slots));
  const sara = slots.find((s) => s.name === 'Sara');
  const ben = slots.find((s) => s.name === 'Ben');
  check(1, sara && /Haymaker/.test(sara.car) && sara.paint === '#ff3b3b' && sara.thumb, 'TV: Sara in a red Haymaker');
  check(1, ben && /Haymaker/.test(ben.car) && ben.paint === '#2f7bff' && ben.thumb, 'TV: Ben in a blue Haymaker');
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await sleep(1500);
  await tv.screenshot({ path: `${L.OUT}/c4-tv-lobby.png` });
  log('screenshot tv lobby');
  await padShot(A.pad, 'padA-lobby-landscape');
  await padShot(B.pad, 'padB-lobby-landscape');
  await B.pad.setViewportSize(PORTRAIT);
  await sleep(400);
  await padShot(B.pad, 'padB-lobby-portrait');
  await B.pad.setViewportSize(L.PAD_SIZE);

  // ---- 2. Pad B: Change car -> Scree ----------------------------------------------------------------
  await B.pad.click('button:has-text("Change car")');
  await B.pad.waitForSelector('#pad-name', { timeout: 10000 });
  const startModel = await model(B.pad);
  check(2, startModel.endsWith('Haymaker'), `edit opens on the current car (${startModel})`);
  await B.pad.click('button[aria-label="Previous car"]');
  await sleep(200);
  check(2, (await model(B.pad)).endsWith('Scree'), 'previous arrow goes to the Scree');
  await B.pad.click('button.pad-btn--big');
  await B.pad.waitForSelector('.pad-ready', { timeout: 30000 });
  const scree = await poll(async () => {
    const s = (await tvSlots(tv)).find((x) => x.name === 'Ben');
    return s && /Scree/.test(s.car) && s.paint === '#2f7bff' ? s : null;
  }, 15000);
  check(2, scree, `TV slot shows Ben's Scree in blue (${JSON.stringify(scree)})`);
  await tv.screenshot({ path: `${L.OUT}/c4-tv-lobby-scree.png` });

  // ---- 3. Reload pad B in the lobby ------------------------------------------------------------------
  const rl = await reloadAndWatch(B.pad, '.pad-ready');
  check(3, rl.done && !rl.sawJoin, `pad B rejoins after a reload without a tap (${rl.ms} ms, sawJoin ${rl.sawJoin})`);
  await sleep(1500);
  const benAfter = (await tvSlots(tv)).find((x) => x.name === 'Ben');
  check(3, benAfter && /Scree/.test(benAfter.car) && benAfter.paint === '#2f7bff' && (await tvSlots(tv)).length === 2,
    `after the reload: still Scree, blue, two players (${JSON.stringify(benAfter)})`);
  const myCar = await B.pad.$eval('.pad-mycar strong', (e) => e.textContent).catch(() => '');
  check(3, /Scree/i.test(myCar), `pad B's lobby card shows the Scree (${myCar})`);

  // ---- 4. Race --------------------------------------------------------------------------------------
  await tv.setViewportSize(L.SMALL);
  await A.pad.click('.pad-ready');
  await B.pad.click('.pad-ready');
  const loadS = await L.waitGameLoaded(tv);
  log(`TV game loaded in ${loadS} s`);
  const lobbyMsg = await A.pad.evaluate(() => window.__msgs.filter((m) => m.type === 'lobby').at(-1));
  const cars = Object.fromEntries((lobbyMsg?.players ?? []).map((p) => [p.name, `${p.car}/${p.colour}`]));
  log('race lobby message cars:', JSON.stringify(cars));
  check(4, cars.Sara === 'haymaker/red' && cars.Ben === 'scree/blue', `race: lobby message has Sara haymaker/red, Ben scree/blue`);
  await A.pad.waitForSelector('.ctl', { timeout: 120000 });
  const green = await L.waitGreen(tv, 1200000);
  check(4, green, 'race went green');
  await tv.keyboard.press('Backquote');
  await sleep(1000);
  const dbg = await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '');
  log(`overlay mentions car ids: haymaker ${/haymaker/.test(dbg)}, scree ${/scree/.test(dbg)} (informational until C5)`);

  // ---- 5. Reload pad A mid-race ---------------------------------------------------------------------
  const hudBefore = await L.hudFor(tv, 'Sara');
  log('huds before reload:', JSON.stringify(await L.huds(tv)));
  const rr = await reloadAndWatch(A.pad, '.ctl', 600000);
  check(5, rr.done && !rr.sawJoin, `pad A back on its controller after a mid-race reload (${rr.ms} ms)`);
  A.cdp = await A.ctx.newCDPSession(A.pad);
  const hudAfter = await L.hudFor(tv, 'Sara');
  check(5, hudBefore && hudAfter && hudAfter.index === hudBefore.index && hudAfter.colour === hudBefore.colour,
    `same viewport and colour (${hudAfter?.index}/${hudAfter?.colour}, was ${hudBefore?.index}/${hudBefore?.colour})`);
  const lobbyAfter = await poll(() => A.pad.evaluate(() => window.__msgs.filter((m) => m.type === 'lobby').at(-1)), 20000);
  const saraP = lobbyAfter?.players.find((p) => p.name === 'Sara');
  check(5, saraP?.car === 'haymaker' && saraP?.colour === 'red', `after reload the TV still has Sara as haymaker/red (${saraP?.car}/${saraP?.colour})`);
  const seat = await A.pad.evaluate(() => sessionStorage.getItem('gamergang.pad.seat'));
  check(5, /"car":"haymaker"/.test(seat ?? ''), `pad A's seat keeps the car (${seat})`);
  const steer = await rect(A.pad, '[data-zone="steer"]');
  const gas = await rect(A.pad, '[data-zone="gas"]');
  await A.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: steer.cx, y: steer.cy, id: 1 }, { x: gas.cx, y: gas.cy, id: 2 }] });
  for (let k = 1; k <= 6; k++) {
    await A.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: steer.cx + k * 15, y: steer.cy, id: 1 }, { x: gas.cx, y: gas.cy, id: 2 }] });
  }
  const drives = await poll(async () => {
    const o = await L.overlay(tv, 'Sara');
    return o && o.gas === 1 && o.steer > 0.2 ? o : null;
  }, 600000, 500);
  check(5, drives, `pad A drives again: ${drives ? drives.line : 'timeout'}`);
  await A.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await padShot(A.pad, 'padA-race-after-reload');

  log(`total ${Math.round((Date.now() - t0) / 1000)} s`);
  L.finish('c4 select.cjs');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
