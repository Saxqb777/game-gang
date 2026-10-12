// Renders the generated-track SVG plan (made in Node from the P2 generator) to a PNG.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 1927 } });
  await page.goto('file:///tmp/claude-0/e2e-p2/p2-map.svg');
  await page.screenshot({ path: '/tmp/claude-0/e2e-p2/p2-map.png', fullPage: true, timeout: 240000 });
  await browser.close();
  console.log('map rendered');
})();
