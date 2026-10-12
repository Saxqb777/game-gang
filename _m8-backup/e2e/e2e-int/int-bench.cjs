// M8 integration acceptance, spec 2.9 item 6 (and 7): ?bench=auto completes on the dressed track,
// logs [splitways-bench] with 3 samples, and its telemetry POSTs return 200. No pageerror.
//
// Usage: node int-bench.cjs <httpPort> <httpsPort>      env: TAG (screenshot prefix), BENCH_MIN (25)
const L = require('./lib.cjs');
const { sleep, log, check, poll } = L;

const BENCH_MIN = Number(process.env.BENCH_MIN ?? 25);

(async () => {
  const browser = await L.launch();
  const ctx = await browser.newContext({ viewport: L.BIG });
  const tv = await ctx.newPage();
  L.watch(tv, 'tv');
  let bench = null;
  const posts = [];
  tv.on('console', (m) => {
    const text = m.text();
    if (text.startsWith('[splitways-bench]')) {
      try {
        bench = JSON.parse(text.slice('[splitways-bench]'.length).trim());
      } catch {
        bench = [];
      }
    }
  });
  tv.on('response', (response) => {
    if (!response.url().endsWith('/api/telemetry')) return;
    let body = {};
    try {
      body = JSON.parse(response.request().postData() ?? '{}');
    } catch {
      body = {};
    }
    const samples = body.samples ?? [];
    posts.push({ status: response.status(), kind: samples[0]?.kind, scenarios: samples.map((s) => s.scenario) });
    log(`telemetry POST ${response.status()}: ${samples.length} samples ${JSON.stringify(samples.map((s) => s.scenario))}`);
  });

  await tv.goto(`${L.HTTP}/tv?bench=auto`);
  await tv.waitForSelector('.lobby-code', { timeout: 90000 });
  await tv.waitForFunction(() => !document.querySelector('.lobby-code').textContent.includes('·'), null, { timeout: 60000 });
  await tv.keyboard.press('KeyK');
  await sleep(500);
  await tv.keyboard.press('Enter');
  await tv.setViewportSize({ width: 480, height: 270 });
  const loadS = await L.waitGameLoaded(tv);
  log(`game loaded in ${loadS} s, benchmark running`);
  const started = Date.now();
  let lastPanel = '';
  let shot = false;
  const done = await poll(async () => {
    const panel = await tv.$eval('.sw-bench', (e) => (e.hidden ? '' : e.textContent)).catch(() => '');
    const head = panel.split('\n')[0];
    if (panel && head !== lastPanel) {
      lastPanel = head;
      log(`panel: ${head}`);
    }
    if (!shot && /run 2\//.test(panel)) {
      shot = true;
      await L.tvShot(tv, 'bench-flythrough');
      await tv.setViewportSize({ width: 480, height: 270 });
    }
    return bench !== null;
  }, BENCH_MIN * 60000, 2000);
  check(6, done, `?bench=auto finished in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  if (done) {
    check(6, Array.isArray(bench) && bench.length === 3, `[splitways-bench] logged ${bench.length} samples: ${bench.map((s) => s.scenario).join(', ')}`);
    await poll(() => posts.some((p) => p.kind === 'flythrough'), 30000);
    const fly = posts.filter((p) => p.kind === 'flythrough');
    check(6, fly.length > 0 && fly.every((p) => p.status === 200), `fly-through telemetry POST answered ${fly.map((p) => p.status).join(', ') || 'nothing'}`);
    const loading = posts.filter((p) => p.kind === 'loading-benchmark');
    check(6, loading.length > 0 && loading.every((p) => p.status === 200), `loading-benchmark telemetry POST answered ${loading.map((p) => p.status).join(', ') || 'nothing'}`);
    await tv.setViewportSize(L.BIG);
    await sleep(6000);
    const table = await tv.$eval('.sw-bench', (e) => e.textContent).catch(() => '');
    log(`results table:\n${table}`);
    check(6, /Kestrel Pines/.test(table), 'benchmark table names Kestrel Pines');
    const path = `${L.OUT}/${L.TAG}-bench-results.png`;
    await tv.screenshot({ path });
    log(`screenshot ${path}`);
  }
  L.finish('int-bench');
  await browser.close();
})().catch((e) => {
  console.error('FAIL [script] crashed:', e);
  for (const x of L.errors) console.error('   pageerror', x);
  process.exit(1);
});
