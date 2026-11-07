/**
 * Browser and accessibility checks: `npm run test:e2e`.
 * Starts the app, or tests a deployed site when BASE_URL is set. Needs a local
 * Chrome or Edge: set CHROME_PATH if it is not at the default location.
 */
const fs = require('fs');
const path = require('path');

const puppeteer = require('puppeteer-core');

const { createApp } = require('../server/app');

const DEFAULT_BROWSERS = [
  '/usr/bin/google-chrome',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const SHOTS = process.env.SHOTS;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  let server;
  let base = process.env.BASE_URL;
  if (!base) {
    server = createApp().listen(0);
    base = `http://localhost:${server.address().port}`;
  }

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? DEFAULT_BROWSERS.find((file) => fs.existsSync(file)),
    headless: 'new',
    args: ['--no-sandbox'],
  });

  const problems = [];
  const failures = [];
  let passed = 0;
  const check = (name, ok, detail = '') => {
    if (ok) passed += 1;
    else failures.push(`${name}${detail ? `: ${detail}` : ''}`);
  };
  const shot = async (page, name, options) => {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), ...options });
  };

  async function open(url, { width = 1440, height = 900, mobile = false } = {}) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`${url}: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
        problems.push(`${url}: ${message.text()}`);
      }
    });
    // Checks read English text, whatever language this computer's browser uses.
    await page.evaluateOnNewDocument(() => {
      try {
        if (!localStorage.getItem('orlo_lang')) localStorage.setItem('orlo_lang', 'en');
      } catch {
        // Internal browser pages have no storage.
      }
    });
    await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
    await page.goto(base + url, { waitUntil: 'networkidle0' });
    return page;
  }

  const text = (page, selector) => page.$eval(selector, (element) => element.textContent.trim());
  const names = (page, selector) =>
    page.$$eval(`${selector} .product-card__name`, (list) => list.map((element) => element.textContent));
  const count = async (page, selector) => (await page.$$(selector)).length;

  // Store: one card per garment, then personalisation across pages.
  let page = await open('/');
  check('popular title', (await text(page, '[data-for-you-title]')) === 'Popular right now');
  check('one card per garment', (await count(page, '[data-catalogue] .product-card')) === 40);
  check('cards show colours', (await count(page, '[data-catalogue] .product-card .card-swatch')) === 120);
  const popular = await names(page, '[data-for-you]');
  await shot(page, 'home');
  await page.click('[data-category="outerwear"]');
  check('filter', (await count(page, '[data-catalogue] .product-card')) === 7);

  await page.goto(`${base}/product?slug=waxed-field-jacket-olive`, { waitUntil: 'networkidle0' });
  check('product title', (await text(page, 'h1')) === 'Waxed Field Jacket');
  const suggested = await names(page, '[data-similar]');
  check('four suggestions', suggested.length === 4);
  check('no other colour of this product', !suggested.includes('Waxed Field Jacket'), suggested.join(', '));
  check('complete the look', (await count(page, '[data-look] .product-card')) === 4);
  check('colour selector', (await count(page, '.swatches a')) === 3);
  check('current colour marked', (await count(page, '.swatches a[aria-current="true"]')) === 1);
  check('no placeholders left', (await count(page, '.skeleton')) === 0);
  const reasons = await page.$$eval('[data-similar] .why', (list) => list.map((e) => e.textContent.trim()));
  check('explanations differ', new Set(reasons).size > 1, reasons.join(' | '));
  const widths = await page.$$eval('[data-similar] .share__part', (list) =>
    list.map((element) => element.getBoundingClientRect().width),
  );
  check(
    'share bars drawn',
    widths.some((width) => width > 10),
  );
  await shot(page, 'product', { fullPage: true });

  await page.click('.swatches a:not([aria-current="true"])');
  await page.waitForNetworkIdle();
  check('colour switch opens the same garment', (await text(page, 'h1')) === 'Waxed Field Jacket');
  await page.click('[data-add]');
  await sleep(500);
  check('add to bag', (await text(page, '[data-add-status]')).startsWith('Added'));
  const tags = await page.$$eval('.chip__tag', (list) => list.map((element) => element.textContent));
  check('history shows the bag', tags.includes('in bag'), tags.join(','));

  await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
  check('personal title', (await text(page, '[data-for-you-title]')) === 'Recommended for you');
  check('list changed', (await names(page, '[data-for-you]')).join() !== popular.join());
  await page.click('[data-clear]');
  await sleep(500);
  check('history cleared', (await page.evaluate(() => sessionStorage.getItem('orlo_history'))) === '[]');
  check('back to popular', (await text(page, '[data-for-you-title]')) === 'Popular right now');

  // Language.
  await page.click('[data-lang="pt"]');
  await sleep(500);
  check('portuguese', (await text(page, 'h1')) === 'Uma loja que mostra o seu raciocínio.');
  check('html lang', (await page.$eval('html', (element) => element.lang)) === 'pt');
  await page.reload({ waitUntil: 'networkidle0' });
  check('language kept', (await text(page, '[data-for-you-title]')) === 'Mais populares agora');
  await page.close();

  const portugueseContext = await browser.createBrowserContext();
  page = await portugueseContext.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'language', { get: () => 'pt-PT' });
  });
  await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
  check('browser language detected', (await page.$eval('html', (element) => element.lang)) === 'pt');
  await page.close();

  // Lab.
  page = await open('/lab');
  await page.click('[data-visitor="heritage"]');
  await sleep(600);
  check('sample visitor marked', (await count(page, '[data-visitor][aria-pressed="true"]')) === 1);
  const before = await names(page, '[data-results]');
  check('eight results', before.length === 8);
  await shot(page, 'lab', { fullPage: true });
  const setSlider = (id, value) =>
    page.$eval(
      `[data-slider="${id}"]`,
      (element, next) => {
        element.value = next;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      },
      value,
    );
  await setSlider('collaborative', 0);
  await setSlider('content', 1);
  await sleep(600);
  check('sliders change the list', (await names(page, '[data-results]')).join() !== before.join());
  await setSlider('content', 0);
  await sleep(400);
  check('all-zero message', (await text(page, '[data-status]')) === 'At least one weight must be above 0.');
  await page.click('[data-reset]');
  await sleep(600);
  check('reset restores the list', (await names(page, '[data-results]')).join() === before.join());
  await page.close();

  // Evaluation.
  page = await open('/evaluation');
  check('evaluation tables', (await count(page, '.data-table')) === 3);
  check('real data section', (await text(page, '[data-real-title]')).length > 0);
  await shot(page, 'evaluation', { fullPage: true });
  await page.close();

  // Errors.
  page = await open('/nope');
  check('404 page', (await text(page, 'h1')) === 'Page not found');
  await page.close();
  page = await open('/product?slug=bad-slug');
  check('unknown product', (await text(page, '.notice p')) === 'Product not found.');
  await page.close();

  page = await open('/');
  await page.setRequestInterception(true);
  let fail = true;
  page.on('request', (request) => {
    if (fail && request.url().includes('/api/recommendations')) request.abort();
    else request.continue();
  });
  await page.reload({ waitUntil: 'networkidle0' });
  check('error state', (await count(page, '[data-for-you] [data-retry]')) === 1);
  fail = false;
  await page.click('[data-for-you] [data-retry]');
  await sleep(500);
  check('retry works', (await count(page, '[data-for-you] .product-card')) === 4);
  await page.close();

  // Mobile layout and accessibility on every page.
  for (const [url, name] of [
    ['/', 'home'],
    ['/product?slug=linen-blazer-sand', 'product'],
    ['/lab', 'lab'],
    ['/evaluation', 'evaluation'],
  ]) {
    page = await open(url, { width: 390, height: 844, mobile: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`no sideways scroll: ${name}`, overflow <= 0, String(overflow));
    await shot(page, `mobile-${name}`);
    await page.close();

    page = await open(url);
    await page.evaluate(AXE);
    const violations = await page.evaluate(async () => {
      const report = await window.axe.run({ runOnly: ['wcag2a', 'wcag2aa'] });
      return report.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].target}`);
    });
    check(`accessibility: ${name}`, violations.length === 0, violations.join('; '));
    await page.close();
  }

  await browser.close();
  server?.close();

  check('no browser errors', problems.length === 0, problems.join(' | '));
  console.log(`${passed} passed, ${failures.length} failed`);
  failures.forEach((failure) => console.log(`FAIL ${failure}`));
  process.exit(failures.length > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
