// P5 first look: one keyboard player on the autopilot, the grid and a few corners at 1920x1080,
// overlay numbers at the grid and mid-lap. Usage: node look.cjs <tag> [t1,t2,...]
const L = require('./lib.cjs');
const tag = process.argv[2] ?? 'look';
const times = (process.argv[3] ?? '11.5,30,47,63.5,86').split(',').map(Number);
const errors = [];
const consoleErrors = [];
(async () => {
  const browser = await L.launch();
  const { tv } = await L.startTv(browser, { errors, consoleErrors });
  await tv.keyboard.press('Backquote');
  await L.sleep(300);
  await tv.keyboard.press('KeyP');
  await L.sleep(1500);
  const o = await L.overlay(tv);
  L.log(`grid overlay: preset ${o.preset} draws ${o.draws} tris ${o.tris} programs ${o.programs} late ${o.late}`);
  await L.shot(tv, `${L.OUT}/${tag}-grid.png`, { settle: 3000, size: { width: 1280, height: 720 } });
  for (const t of times) {
    await L.poll(async () => (await L.lapSeconds(tv)) >= t, 30 * 60000, 200);
    const o2 = await L.overlay(tv);
    L.log(`t=${t}: preset ${o2.preset} draws ${o2.draws} tris ${o2.tris} late ${o2.late}`);
    await L.shot(tv, `${L.OUT}/${tag}-t${t}.png`, { settle: 2500, size: { width: 1280, height: 720 } });
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
