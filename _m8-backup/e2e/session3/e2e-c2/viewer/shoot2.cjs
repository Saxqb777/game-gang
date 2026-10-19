const { chromium } = require('playwright');
(async () => {
  const [,, url, out] = process.argv;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__done, null, { timeout: 120000 });
  await page.screenshot({ path: out });
  await browser.close();
})();
