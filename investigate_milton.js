const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const ARTIFACTS_DIR = '/Users/ashishtayal/.gemini/antigravity-ide/brain/8d1955bc-301f-48e0-bc32-fddbcfa0e101/screenshots';

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function saveScreenshot(page, filename) {
  const localPath = path.join(SCREENSHOTS_DIR, filename);
  const artifactPath = path.join(ARTIFACTS_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: false });
  fs.copyFileSync(localPath, artifactPath);
  console.log(`Saved screenshot: ${filename}`);
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Homepage Top / Hero
  console.log('Navigating to Homepage...');
  await page.goto('https://www.milton.in/', { waitUntil: 'networkidle2', timeout: 45000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 2000));
  await saveScreenshot(page, '01_homepage_hero_nav.png');

  // Hover over Categories/Bottles menu if available
  try {
    const navItems = await page.$$('.header__menu-item, .nav-item, [data-menu-item]');
    for (const item of navItems) {
      const text = await (await item.getProperty('textContent')).jsonValue();
      if (/bottle|drinkware/i.test(text)) {
        await item.hover();
        await new Promise(r => setTimeout(r, 1000));
        await saveScreenshot(page, '01b_homepage_nav_dropdown.png');
        break;
      }
    }
  } catch (e) {
    console.log('Dropdown hover skipped:', e.message);
  }

  // 2. Homepage Collections Scroll
  console.log('Scrolling homepage...');
  await page.evaluate(() => window.scrollTo(0, 750));
  await new Promise(r => setTimeout(r, 1500));
  await saveScreenshot(page, '02_homepage_collections.png');

  // 3. Collection Page: Thermosteel Bottles
  console.log('Navigating to Thermosteel Bottles collection...');
  await page.goto('https://www.milton.in/collections/thermosteel-bottles', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 2000));
  await saveScreenshot(page, '03_bottles_collection_desktop.png');

  // Extract filter facets
  const filtersData = await page.evaluate(() => {
    const filters = [];
    document.querySelectorAll('.filter-group, details[id*="filter"], .facets__item, .f-filter').forEach(el => {
      filters.push(el.innerText.trim().replace(/\n+/g, ' '));
    });
    return filters.slice(0, 15);
  });
  console.log('Collection filters detected:', filtersData);

  // 4. Product Detail Page (PDP): Felice Thermosteel Bottle
  console.log('Navigating to Felice Thermosteel Bottle PDP...');
  await page.goto('https://www.milton.in/products/felice-thermosteel-bottle-milton', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 2500));
  await saveScreenshot(page, '04_bottle_pdp_desktop.png');

  // Click on a different variant swatch if available
  try {
    const swatches = await page.$$('.swatch-color, .product-form__input input[type="radio"] + label, [data-option-value]');
    if (swatches.length > 2) {
      await swatches[1].click();
      await new Promise(r => setTimeout(r, 1200));
      await saveScreenshot(page, '04b_bottle_pdp_variant_switch.png');
    }
  } catch (e) {
    console.log('Swatch click error:', e.message);
  }

  // 5. Scroll to PDP specifications & highlights
  console.log('Scrolling PDP to specs...');
  await page.evaluate(() => window.scrollTo(0, 800));
  await new Promise(r => setTimeout(r, 1500));
  await saveScreenshot(page, '05_bottle_pdp_features_specs.png');

  // 6. Test Add to Cart & Drawer
  console.log('Adding to cart...');
  try {
    const addBtn = await page.$('button[name="add"], .product-form__submit, #AddToCart');
    if (addBtn) {
      await addBtn.click();
      await new Promise(r => setTimeout(r, 3000));
      await saveScreenshot(page, '06_cart_drawer.png');
    }
  } catch (e) {
    console.log('Cart drawer error:', e.message);
  }

  // 7. Mobile Viewport (iPhone 14 / modern device)
  console.log('Switching to mobile viewport...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('https://www.milton.in/products/felice-thermosteel-bottle-milton', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 2000));
  await saveScreenshot(page, '07_bottle_pdp_mobile.png');

  await browser.close();
  console.log('All investigation screenshots captured successfully!');
}

run().catch(err => {
  console.error('Fatal error during investigation:', err);
  process.exit(1);
});
