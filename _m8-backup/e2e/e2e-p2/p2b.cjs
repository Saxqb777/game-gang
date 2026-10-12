// P2 acceptance 4b: grass and gravel slow the car. One keyboard player: full gas down the main
// straight, then coast straight on at T1 into its gravel trap; then (debug N) from the Brook run,
// gas to ~90 km/h and coast straight on at Sawpit onto the grass. The overlay speed is sampled
// against the HUD lap clock (race time), so the deceleration is in race seconds.
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/claude-0/e2e-p2';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const errors = [];
const consoleErrors = [];
const check = (ok, what) => {
  log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  if (!ok) process.exitCode = 1;
};
async function poll(fn, timeoutMs, stepMs = 250) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) return value;
    await sleep(stepMs);
  }
}
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  tv.on('pageerror', (e) => errors.push(`[tv] ${e.message}`));
  tv.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[tv] ${m.text().slice(0, 300)}`);
  });
  await tv.goto('http://localhost:4100/tv');
  await tv.waitForSelector('.lobby-code', { timeout: 30000 });
  await tv.keyboard.press('KeyK');
  await tv.waitForFunction(() => document.querySelectorAll('.slot:not(.slot--empty)').length === 1, null, { timeout: 10000 });
  await tv.setViewportSize({ width: 480, height: 270 });
  await tv.keyboard.press('Enter');
  await tv.waitForSelector('.sw-canvas', { state: 'attached', timeout: 150000 });
  await tv.waitForFunction(() => !document.querySelector('.sw-loading'), null, { timeout: 150000 });
  log('game loaded');
  await tv.keyboard.press('Backquote');
  const lapClock = async () => {
    const t = await tv.$eval('.sw-hud-laptime', (e) => e.textContent).catch(() => '');
    const m = /(\d+):(\d+(?:\.\d+)?)/.exec(t);
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  };
  const kph = async () => {
    const lines = (await tv.$eval('.sw-debug', (e) => e.textContent).catch(() => '')).split('\n');
    const header = lines.findIndex((l) => l.startsWith('driver'));
    const cols = (lines[header + 1] ?? '').trim().split(/\s+/);
    return Number(cols[cols.length - 6]);
  };
  const raceGo = await poll(async () => (await lapClock()) > 0, 120000);
  check(Boolean(raceGo), 'race went green');

  /** Samples (race s, km/h) until `until(sample)` or `limitS` of race time. */
  const sample = async (limitS, until) => {
    const out = [];
    const t0 = await lapClock();
    for (;;) {
      const s = { t: await lapClock(), v: await kph() };
      if (Number.isFinite(s.t) && Number.isFinite(s.v) && (out.length === 0 || s.t > out[out.length - 1].t)) out.push(s);
      if ((until && until(s, out)) || s.t - t0 > limitS) return out;
      await sleep(120);
    }
  };
  /**
   * Steepest deceleration (m/s^2) over windows of at least `span` race seconds, using only the
   * samples before the sharpest single-sample drop (hitting the barrier at the end of the run-off).
   */
  const decel = (samples, span = 0.6) => {
    let impact = samples.length;
    let sharpest = 0;
    for (let i = 1; i < samples.length; i++) {
      const rate = (samples[i - 1].v - samples[i].v) / 3.6 / (samples[i].t - samples[i - 1].t);
      if (rate > sharpest && rate > 15) {
        sharpest = rate;
        impact = i;
      }
    }
    const before = samples.slice(0, impact);
    let best = 0;
    for (let i = 0; i < before.length; i++) {
      for (let j = i + 1; j < before.length; j++) {
        const dt = before[j].t - before[i].t;
        if (dt < span) continue;
        best = Math.max(best, (before[i].v - before[j].v) / 3.6 / dt);
        break;
      }
    }
    return best;
  };
  const show = (name, s) => log(name, s.map((x) => `${x.t.toFixed(1)}:${x.v}`).join(' '));

  // 1. Gravel: gas to 150 km/h on the main straight, coast on asphalt, then straight on into T1.
  await tv.keyboard.down('KeyW');
  const launch = await sample(20, (s) => s.v >= 150);
  await tv.keyboard.up('KeyW');
  show('launch', launch);
  const coast = await sample(25, (s, all) => all.length > 3 && s.v < 3 && all[all.length - 2].v < 3);
  show('coast to T1 gravel', coast);
  // Asphalt coasting: the first 1.5 race seconds after the lift.
  const lift = coast[0].t;
  const asphaltCoast = coast.filter((s) => s.t <= lift + 1.5);
  const asphaltRate = (asphaltCoast[0].v - asphaltCoast[asphaltCoast.length - 1].v) / 3.6 / (asphaltCoast[asphaltCoast.length - 1].t - asphaltCoast[0].t);
  const gravelRate = decel(coast.filter((s) => s.t > lift + 1.5));
  log(`asphalt coast ${asphaltRate.toFixed(2)} m/s^2, steepest later deceleration ${gravelRate.toFixed(2)} m/s^2`);
  await tv.keyboard.press('Backquote');
  await tv.setViewportSize({ width: 1280, height: 720 });
  await sleep(2500);
  await tv.screenshot({ path: `${OUT}/p2b-t1-gravel.png` });
  await tv.setViewportSize({ width: 480, height: 270 });
  await tv.keyboard.press('Backquote');
  check(asphaltRate < 1.2, `coasting on asphalt loses ${asphaltRate.toFixed(2)} m/s^2`);
  check(gravelRate > 3.5, `the T1 gravel trap slows the coasting car at up to ${gravelRate.toFixed(2)} m/s^2`);

  // 2. Grass: back to the Brook run with N (debug: next gate), gas to ~90 km/h, coast on at Sawpit.
  await sleep(500);
  await tv.keyboard.press('KeyN');
  await sleep(1500);
  await tv.keyboard.down('KeyW');
  const launch2 = await sample(15, (s) => s.v >= 90);
  await tv.keyboard.up('KeyW');
  show('launch at Brook run', launch2);
  const coast2 = await sample(25, (s, all) => all.length > 3 && s.v < 3 && all[all.length - 2].v < 3);
  show('coast onto Sawpit grass', coast2);
  const lift2 = coast2[0].t;
  const firstPart = coast2.filter((s) => s.t <= lift2 + 1.2);
  const asphaltRate2 = (firstPart[0].v - firstPart[firstPart.length - 1].v) / 3.6 / (firstPart[firstPart.length - 1].t - firstPart[0].t);
  const grassRate = decel(coast2.filter((s) => s.t > lift2 + 1.2), 1.0);
  log(`asphalt coast ${asphaltRate2.toFixed(2)} m/s^2, steepest later 1 s deceleration ${grassRate.toFixed(2)} m/s^2`);
  await tv.keyboard.press('Backquote');
  await tv.setViewportSize({ width: 1280, height: 720 });
  await sleep(2500);
  await tv.screenshot({ path: `${OUT}/p2b-sawpit-grass.png` });
  check(grassRate > 2 * Math.max(0.3, asphaltRate2), `grass slows the coasting car at ${grassRate.toFixed(2)} m/s^2 against ${asphaltRate2.toFixed(2)} on asphalt`);

  check(errors.length === 0, `no pageerror (${errors.length})`);
  for (const e of errors) log('  ', e);
  log(`console errors: ${consoleErrors.length}`);
  for (const e of consoleErrors) log('  ', e);
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  for (const x of errors) console.error('  ', x);
  process.exit(1);
});
