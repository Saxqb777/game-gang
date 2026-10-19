const { chromium } = require('playwright');
(async () => {
  const [,, port, out, ...cars] = process.argv;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.text().slice(0, 200)); });
  for (const spec of cars) {
    const [car, views] = spec.split('@');
    await page.goto(`http://localhost:${port}/viewer.html?car=${car}${views ? '&views=' + encodeURIComponent(views) : ''}`);
    await page.waitForFunction(() => window.__done, null, { timeout: 120000 });
    await page.screenshot({ path: `${out}/${car}${views ? '-custom' : ''}.png` });
    console.log('shot', car);
  }
  await browser.close();
})();
