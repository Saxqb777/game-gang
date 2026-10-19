// Drives /tools/thumbs: waits for all renders, screenshots the page, clicks Download all, saves the zip.
const { chromium } = require('playwright');
(async () => {
  const [,, port, outDir] = process.argv;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text().slice(0, 300)); });
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/tools/thumbs`);
  await page.waitForSelector('[data-state="ready"], [data-state="error"]', { timeout: 600000 });
  console.log('state', await page.textContent('header p'), `${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await page.screenshot({ path: `${outDir}/studio.png`, fullPage: true });
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('text=Download all')]);
  await download.saveAs(`${outDir}/car-thumbs.zip`);
  console.log('zip saved');
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
