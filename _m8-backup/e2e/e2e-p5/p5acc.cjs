// P5 acceptance scenarios. Usage: node p5acc.cjs <mode>
//  views2   2 keyboard players (Medium): overlay at the grid and mid-lap, screenshot (c)
//  views4   4 players with bots (Low): overlay at the grid and mid-lap, screenshot (d), tile seams
//  views3   3 players: the overview cell, screenshot (e)
//  gravel   1 player floors it straight into the T1 gravel: dust, screenshot (f)
//  race     4 cars on the autopilot (real clock) finish a race; podium screenshot (g); no errors
const { execFileSync } = require('child_process');
const fs = require('fs');
const L = require('./lib.cjs');
const mode = process.argv[2];
const errors = [];
const consoleErrors = [];
const recon = fs
  .readFileSync(`${L.OUT}/recon.txt`, 'utf8')
  .trim()
  .split('\n')
  .map((l) => l.split(' ').map(Number));
const timeAt = (distance) => recon.find(([, lap, d]) => lap === 1 && d >= distance && d < distance + 200)?.[0] ?? NaN;

async function overlayAt(tv, label) {
  const o = await L.overlay(tv);
  L.log(`${label}: preset ${o.preset} viewports ${o.viewports} draws ${o.draws} tris ${o.tris} programs ${o.programs} late ${o.late}`);
  return o;
}

function seams(path, views) {
  try {
    const out = execFileSync('python3', ['-I', `${L.OUT}/tiles.py`, path, String(views)], { encoding: 'utf8' });
    L.log(out.trim().replace(/\n/g, ' | '));
    return true;
  } catch (e) {
    L.log(String(e.stdout ?? e));
    return false;
  }
}

(async () => {
  const browser = await L.launch();
  if (mode === 'views2' || mode === 'views4' || mode === 'views3') {
    const players = { views2: 2, views3: 3, views4: 4 }[mode];
    const { tv } = await L.startTv(browser, { query: mode === 'views4' ? '?bots=1' : '', keys: players, errors, consoleErrors, small: { width: 480, height: 270 } });
    await tv.keyboard.press('Backquote');
    await L.sleep(300);
    await tv.keyboard.press('KeyP');
    await tv.keyboard.press('KeyR');
    await L.sleep(800);
    const grid = await overlayAt(tv, `${players}P grid`);
    L.check(grid.late === '0', `${players}P: no shader compiled after the loading screen (late ${grid.late})`);
    await L.shot(tv, `${L.OUT}/p5-${mode}-grid.png`, { size: { width: 1280, height: 720 }, small: { width: 480, height: 270 }, settle: 3000, hud: true });
    const at = timeAt(1700);
    await L.fast(tv, true);
    await L.poll(async () => (await L.lapSeconds(tv)) >= at - 1.5, 60 * 60000, 300);
    await L.fast(tv, false);
    await L.poll(async () => (await L.lapSeconds(tv)) >= at, 60 * 60000, 300);
    const mid = await overlayAt(tv, `${players}P mid-lap (Kestrel)`);
    L.check(mid.late === '0', `${players}P: no late shader mid-lap (late ${mid.late})`);
    const path = `${L.OUT}/p5-${mode}-midlap.png`;
    await L.shot(tv, path, { size: { width: 1280, height: 720 }, small: { width: 480, height: 270 }, settle: 3000 });
    if (mode !== 'views2') L.check(seams(path, players), `${players} views render with clean seams`);
  } else if (mode === 'gravel') {
    const { tv } = await L.startTv(browser, { errors, consoleErrors });
    await tv.keyboard.press('Backquote');
    await tv.keyboard.press('KeyR');
    await tv.keyboard.press('Backquote');
    await L.fast(tv, true);
    await L.poll(async () => (await L.lapSeconds(tv)) > 0, 10 * 60000, 200);
    await tv.keyboard.down('KeyW');
    await L.poll(async () => (await L.lapSeconds(tv)) >= 9.5, 10 * 60000, 150);
    await L.fast(tv, false);
    for (const t of [10.6, 11.4, 12.2]) {
      await L.poll(async () => (await L.lapSeconds(tv)) >= t, 10 * 60000, 150);
      await L.shot(tv, `${L.OUT}/p5-gravel-t${t}.png`, { size: { width: 1280, height: 720 }, settle: 2500 });
    }
    await tv.keyboard.up('KeyW');
  } else if (mode === 'bench') {
    const lines = [];
    const { tv } = await L.startTv(browser, { query: '?bench=auto', keys: 1, virtual: false, errors, consoleErrors, small: { width: 640, height: 360 } });
    tv.on('console', (m) => {
      if (m.text().startsWith('[splitways-bench]')) lines.push(m.text());
    });
    const done = await L.poll(() => lines.length > 0, 40 * 60000, 2000);
    L.check(done, '?bench=auto completed on the dressed track');
    if (done) {
      const samples = JSON.parse(lines[0].slice('[splitways-bench] '.length));
      for (const x of samples) L.log(`bench ${x.scenario}: preset ${x.preset} viewports ${x.viewports} drawCallsAvg ${x.drawCallsAvg.toFixed(0)} trianglesAvg ${(x.trianglesAvg / 1e6).toFixed(2)}M`);
    }
    await tv.screenshot({ path: `${L.OUT}/p5-bench-results.png`, timeout: 300000 });
  } else if (mode === 'race') {
    const { tv } = await L.startTv(browser, { query: '?bots=1', keys: 4, virtual: false, errors, consoleErrors, small: { width: 400, height: 225 } });
    await tv.keyboard.press('Backquote');
    await L.sleep(300);
    await tv.keyboard.press('KeyP');
    const started = Date.now();
    let lastLog = 0;
    const finished = await L.poll(async () => {
      if (await tv.$('.sw-results')) return true;
      if (Date.now() - lastLog > 60000) {
        lastLog = Date.now();
        const o = await L.overlay(tv);
        L.log(`racing: lap ${await L.lapNumber(tv)} ${o.preset} draws ${o.draws} tris ${o.tris} late ${o.late}`);
      }
      return false;
    }, 120 * 60000, 2000);
    L.check(finished, `4-car autopilot race finished in ${((Date.now() - started) / 60000).toFixed(1)} min wall time`);
    await tv.keyboard.press('Backquote');
    await tv.evaluate(() => {
      const results = document.querySelector('.sw-results');
      if (results) results.style.visibility = 'hidden';
    });
    await tv.setViewportSize({ width: 1280, height: 720 });
    await L.sleep(12000);
    const podium = `${L.OUT}/p5-podium.png`;
    await tv.screenshot({ path: podium, timeout: 300000 });
    L.check(seams(podium, 1), 'podium renders full screen');
    await tv.evaluate(() => {
      const results = document.querySelector('.sw-results');
      if (results) results.style.visibility = '';
    });
    await L.sleep(1000);
    await tv.screenshot({ path: `${L.OUT}/p5-results.png`, timeout: 300000 });
  }
  L.check(errors.length === 0, `no pageerror (${errors.length})`);
  for (const e of errors) L.log('  ', e);
  L.check(consoleErrors.length === 0, `no console or WebGL errors (${consoleErrors.length})`);
  for (const e of consoleErrors.slice(0, 20)) L.log('  ', e);
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  for (const x of errors) console.error('  ', x);
  process.exit(1);
});
