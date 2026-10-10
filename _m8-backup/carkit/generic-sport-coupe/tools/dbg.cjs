const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const glb = process.argv[2];
const THREE_DIR = '/home/user/game-gang/node_modules/.pnpm/three@0.186.1/node_modules/three';
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = url === '/' ? path.join(__dirname, 'preview.html') : url === '/car.glb' ? glb : url.startsWith('/three/') ? path.join(THREE_DIR, url.slice(7)) : null;
  if (!file || !fs.existsSync(file)) { console.log('404', url); res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
server.listen(0, async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
  console.log(await page.evaluate(fs.readFileSync(path.join(__dirname,'dbg_eval.js'),'utf8')));
  await browser.close(); server.close();
});
