// usage: node render.cjs <glb> <out.png> [query]   (run under flock /tmp/claude-0/m8-browser.lock)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const path = require('path');
const THREE_DIR = '/home/user/game-gang/node_modules/.pnpm/three@0.186.1/node_modules/three';
(async () => {
  const jobs = JSON.parse(process.argv[2]); // [{glb,out,query}]
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const job of jobs) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.route('http://kit.local/**', async (route) => {
      const u = new URL(route.request().url());
      let file;
      if (u.pathname === '/' || u.pathname === '/index.html') file = path.join(__dirname, 'preview.html');
      else if (u.pathname === '/model.glb') file = job.glb;
      else if (u.pathname.startsWith('/three/')) file = path.join(THREE_DIR, u.pathname.slice(7));
      if (!file || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'nf' });
      const ct = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream';
      route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': ct } });
    });
    await page.goto('http://kit.local/index.html?' + (job.query || ''));
    await page.waitForFunction(() => window.__done === true, null, { timeout: 180000 });
    await page.locator('canvas').screenshot({ path: job.out });
    console.log('wrote', job.out);
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
