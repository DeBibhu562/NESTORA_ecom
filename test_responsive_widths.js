const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const VIEWPORTS = [
  { name: '320px_iPhone_SE_Old', width: 320, height: 568 },
  { name: '360px_Android_Standard', width: 360, height: 800 },
  { name: '375px_iPhone_SE_Modern', width: 375, height: 667 },
  { name: '390px_iPhone_14', width: 390, height: 844 },
  { name: '412px_Pixel_Galaxy', width: 412, height: 915 },
  { name: '430px_iPhone_Pro_Max', width: 430, height: 932 },
  { name: '768px_iPad_Portrait', width: 768, height: 1024 },
  { name: '1024px_iPad_Landscape', width: 1024, height: 1366 },
];

const OUT_DIR = path.join(__dirname, 'screenshots', 'responsive');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function runAudit() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const report = [];

  for (const vp of VIEWPORTS) {
    console.log(`Testing viewport ${vp.name} (${vp.width}x${vp.height})...`);
    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 1024, hasTouch: vp.width < 1024 });
    await page.goto('http://localhost:3010', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1200));

    // 1. Check Horizontal Overflow on Home
    const overflowInfo = await page.evaluate(() => {
      const docWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const bodyScrollWidth = document.body.scrollWidth;
      const hasOverflow = scrollWidth > docWidth + 1 || bodyScrollWidth > docWidth + 1;

      // Find overflowing elements
      const overflowingElements = [];
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.right > docWidth + 2) {
          overflowingElements.push({
            tag: el.tagName.toLowerCase(),
            className: el.className ? String(el.className).slice(0, 80) : '',
            right: Math.round(rect.right),
            docWidth,
            diff: Math.round(rect.right - docWidth)
          });
          if (overflowingElements.length >= 5) break;
        }
      }

      return { docWidth, scrollWidth, bodyScrollWidth, hasOverflow, overflowingElements };
    });

    // Save Home screenshot
    const homeScreenshot = path.join(OUT_DIR, `${vp.name}_home.png`);
    await page.screenshot({ path: homeScreenshot });

    // 2. Test opening PDP Modal on mobile
    let pdpModalFits = true;
    let pdpModalOverflow = null;
    try {
      await page.evaluate(() => {
        const h3 = Array.from(document.querySelectorAll('h3')).find(el => el.innerText.includes('Aero'));
        if (h3) h3.click();
      });
      await new Promise(r => setTimeout(r, 1000));

      pdpModalOverflow = await page.evaluate(() => {
        const modal = document.querySelector('[class*="fixed inset-0"] > div');
        if (!modal) return null;
        const rect = modal.getBoundingClientRect();
        return {
          modalWidth: Math.round(rect.width),
          modalHeight: Math.round(rect.height),
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          exceedsWidth: rect.right > window.innerWidth + 2,
          exceedsHeight: rect.height > window.innerHeight
        };
      });

      const modalScreenshot = path.join(OUT_DIR, `${vp.name}_modal.png`);
      await page.screenshot({ path: modalScreenshot });

      // Close modal
      await page.evaluate(() => {
        const closeBtn = document.querySelector('button[aria-label="Close dialog"]');
        if (closeBtn) closeBtn.click();
      });
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {
      console.log(`Modal test error on ${vp.name}:`, e.message);
    }

    // 3. Test Cart Drawer
    let cartDrawerFits = true;
    try {
      await page.evaluate(() => {
        const cartBtn = document.querySelector('button[aria-label="View Shopping Cart"]');
        if (cartBtn) cartBtn.click();
      });
      await new Promise(r => setTimeout(r, 1000));

      const cartScreenshot = path.join(OUT_DIR, `${vp.name}_cart.png`);
      await page.screenshot({ path: cartScreenshot });

      // Close cart drawer
      await page.evaluate(() => {
        const closeBtn = document.querySelector('button[aria-label="Close cart"]');
        if (closeBtn) closeBtn.click();
      });
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {
      console.log(`Cart test error on ${vp.name}:`, e.message);
    }

    report.push({
      viewport: vp,
      overflowInfo,
      pdpModalOverflow
    });
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT_DIR, 'responsive_report.json'), JSON.stringify(report, null, 2));
  console.log('Responsive audit completed! Results written to responsive_report.json');
}

runAudit().catch(err => {
  console.error('Fatal error during audit:', err);
  process.exit(1);
});
