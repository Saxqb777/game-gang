// P5 hero shots at 1920x1080: one keyboard player on the autopilot (virtual 60 Hz clock, so the
// race clock maps to a place on the lap through the Node recon in recon.txt). The grid during the
// countdown, then each landmark on lap 1. Usage: node heroes.cjs <tag> [name=distance,...]
const fs = require('fs');
const L = require('./lib.cjs');
const tag = process.argv[2] ?? 'hero';
const [w, h] = (process.env.SIZE ?? '1920x1080').split('x').map(Number);
const size = { width: w, height: h };
const DEFAULT = 't1-entry=262,t1-apex=305,ladder=820,brow=1035,windhover=1320,kestrel-entry=1600,kestrel=1720,drop=2040,beck=2262,hollow=2470,larch=2690,switchback=3040,switchback-exit=3110';
const targets = (process.argv[3] ?? DEFAULT).split(',').map((pair) => {
  const [name, d] = pair.split('=');
  return { name, distance: Number(d) };
});
// recon.txt rows: clock lap distance kph lapStartedAt
const recon = fs
  .readFileSync(`${L.OUT}/recon.txt`, 'utf8')
  .trim()
  .split('\n')
  .map((l) => l.split(' ').map(Number));
function timeAt(distance) {
  for (const [clock, lap, d] of recon) if (lap === 1 && d >= distance && d < distance + 200) return clock;
  return NaN;
}
const errors = [];
const consoleErrors = [];
(async () => {
  const browser = await L.launch();
  const { tv } = await L.startTv(browser, { errors, consoleErrors });
  await tv.keyboard.press('Backquote');
  await L.sleep(300);
  await tv.keyboard.press('KeyP');
  // Pin the resolution scale at 1, and run the virtual clock at 5 steps a frame between shots.
  await tv.keyboard.press('KeyR');
  await L.sleep(800);
  const o = await L.overlay(tv);
  L.log(`grid overlay: preset ${o.preset} draws ${o.draws} tris ${o.tris} programs ${o.programs} late ${o.late}`);
  await L.shot(tv, `${L.OUT}/${tag}-grid.png`, { settle: 3500, size });
  await L.fast(tv, true);
  for (const t of targets) {
    const at = timeAt(t.distance);
    if (!Number.isFinite(at)) {
      L.log(`no recon time for ${t.name}`);
      continue;
    }
    // Fast to just before, then one step a frame; arrive a few frames early for the enlarge.
    await L.poll(async () => (await L.lapSeconds(tv)) >= at - 1.5, 60 * 60000, 150);
    await L.fast(tv, false);
    await L.poll(async () => (await L.lapSeconds(tv)) >= at - 0.1, 10 * 60000, 150);
    const o2 = await L.overlay(tv);
    L.log(`${t.name} (${t.distance} m, t=${at.toFixed(1)} s): preset ${o2.preset} draws ${o2.draws} tris ${o2.tris} late ${o2.late}`);
    await L.shot(tv, `${L.OUT}/${tag}-${t.name}.png`, { settle: 2500, size });
    await L.fast(tv, true);
  }
  L.check(errors.length === 0, `no pageerror (${errors.length})`);
  for (const e of errors) L.log('  ', e);
  L.log(`console errors: ${consoleErrors.length}`);
  for (const e of consoleErrors.slice(0, 20)) L.log('  ', e);
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  for (const x of errors) console.error('  ', x);
  process.exit(1);
});
