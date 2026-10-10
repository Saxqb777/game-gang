// usage: node render.cjs <glb> <shots.json> [w h]   (run under flock /tmp/claude-0/m8-browser.lock)
// shots.json: [{out, view|dir, dist, fov, target, highlight[], hide[], only[], glow, ground}]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const path = require('path');
const THREE_DIR = '/home/user/game-gang/node_modules/.pnpm/three@0.186.1/node_modules/three';
(async () => {
  const glb = process.argv[2]; const shots = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const w = +process.argv[4] || 1600, h = +process.argv[5] || 900;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.route('http://kit.local/**', async (route) => {
    const u = new URL(route.request().url()); let file;
    if (u.pathname === '/index.html') file = path.join(__dirname, "preview.html");
    else if (u.pathname === '/model.glb') file = glb;
    else if (u.pathname.startsWith('/three/')) file = path.join(THREE_DIR, u.pathname.slice(7));
    if (!file || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'nf' });
    const ct = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream';
    route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': ct } });
  });
  await page.goto(`http://kit.local/index.html?w=${w}&h=${h}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  for (const s of shots) {
    const url = await page.evaluate((spec) => window.shoot(spec), s);
    fs.writeFileSync(s.out, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', s.out);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
