const puppeteer = require('puppeteer');
const path = require('path');

async function testLocal() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to http://localhost:3010...');
  await page.goto('http://localhost:3010', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  const scrDir = path.join(__dirname, 'screenshots');

  // 1. Home & Hero
  await page.screenshot({ path: path.join(scrDir, 'local_01_homepage.png') });
  console.log('Saved local_01_homepage.png');

  // 2. Click the first product card title to open PDP Modal
  console.log('Clicking first product card...');
  await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('h3'));
    const prodTitle = titles.find(t => t.innerText.includes('Aero Thermosteel'));
    if (prodTitle) prodTitle.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(scrDir, 'local_03_pdp_modal.png') });
  console.log('Saved local_03_pdp_modal.png');

  // 3. Click Add to Cart inside PDP Modal
  console.log('Clicking Add to Cart...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const add = btns.find(b => b.innerText.includes('Add to Cart'));
    if (add) add.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(scrDir, 'local_04_cart_drawer.png') });
  console.log('Saved local_04_cart_drawer.png');

  // 4. Mobile Viewport
  console.log('Testing mobile view...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3010', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(scrDir, 'local_05_mobile.png') });
  console.log('Saved local_05_mobile.png');

  await browser.close();
  console.log('All local verification screenshots captured successfully!');
}

testLocal().catch(err => {
  console.error('Error during local verification:', err);
  process.exit(1);
});
