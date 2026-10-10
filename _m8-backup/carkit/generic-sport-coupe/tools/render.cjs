// Serves preview.html + three + the GLB and screenshots the named views with headless Chromium.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [glb, outDir, ...views] = process.argv.slice(2);
const THREE_DIR = '/home/user/game-gang/node_modules/.pnpm/three@0.186.1/node_modules/three';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file;
  if (url === '/') file = path.join(__dirname, 'preview.html');
  else if (url === '/car.glb') file = glb;
  else if (url.startsWith('/three/')) { file = path.normalize(path.join(THREE_DIR, url.slice(7))); if (!file.startsWith(THREE_DIR)) file = null; }
  if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/` + (process.env.Q || ''));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
  for (const v of views) {
    const url = await page.evaluate((n) => window.shot(n), v);
    fs.writeFileSync(path.join(outDir, `preview-${v}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log('saved', v);
  }
  await browser.close(); server.close();
});
