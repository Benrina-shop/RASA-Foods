// Run with Playwright installed: node tests/product-engagement.cjs
// Optional: PLAYWRIGHT_MODULE_PATH points to an existing playwright package.
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const playwrightPath = process.env.PLAYWRIGHT_MODULE_PATH || 'playwright';
const { chromium } = require(playwrightPath);
const { expect } = require(playwrightPath + '/test');
const root = path.resolve(__dirname, '..');
const products = [
  { id: 901, name: 'Premium Gift Box', price: 14900, old_price: 16000, stock: 10, category_slug: 'gifts', image_url: 'logo.png', description: 'Gift box', images: [] },
  { id: 902, name: 'Everyday Treat', price: 800, old_price: 1000, stock: 0, category_slug: 'gifts', image_url: 'logo.png', description: 'Treat', images: [] }
];

(async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end(); return;
    }
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(file)] || 'text/plain';
    res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
    // Deterministic fixtures for the external Supabase API; no production writes.
    await context.route('**/*.supabase.co/**', async route => {
      const url = new URL(route.request().url());
      assert.equal(route.request().method(), 'GET', 'Tests must never write to Supabase');
      let data = [];
      if (url.pathname.endsWith('/products')) data = url.searchParams.has('id') ? products.find(p => 'eq.' + p.id === url.searchParams.get('id')) : products;
      if (url.pathname.endsWith('/categories')) data = url.searchParams.has('slug') ? null : [{ id: 1, name: 'Gifts', slug: 'gifts', image_url: 'logo.png' }];
      await route.fulfill({ json: data });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/products.html');
    const widget = page.locator('[data-engagement-id="901"]');
    await expect(widget).toBeVisible();
    await widget.getByRole('button', { name: 'Like', exact: true }).click();
    await expect(widget.getByRole('button', { name: 'Like', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/products\.html$/);
    assert.equal(await page.evaluate(() => localStorage.getItem('rasa-cart')), null);
    await widget.getByRole('button', { name: 'Love', exact: true }).click();
    await expect(widget.getByRole('button', { name: 'Like', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(widget.getByRole('button', { name: 'Love', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await widget.getByRole('button', { name: 'Love', exact: true }).click();
    await expect(widget.getByRole('button', { name: 'Love', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await widget.getByRole('button', { name: 'Wow', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(widget.getByRole('button', { name: 'Wow', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await widget.getByRole('button', { name: 'Add to Wishlist', exact: true }).click();
    await page.reload();
    await expect(widget.getByRole('button', { name: 'Saved to Wishlist', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(widget.getByRole('button', { name: 'Wow', exact: true })).toHaveAttribute('aria-pressed', 'true');
    console.log('PASS reaction select/change/remove, keyboard, no card navigation/cart side effects, reload persistence');

    for (const url of ['/index.html', '/offers.html', '/product-detail.html?id=901']) {
      await page.goto(url);
      await expect(widget.getByRole('button', { name: 'Saved to Wishlist', exact: true })).toBeVisible();
      await expect(widget.getByRole('button', { name: 'Wow', exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    await page.locator('#nav-search-input').fill('Premium');
    await expect(page.locator('#live-search-results').getByText('Premium Gift Box', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('#nav-search-input-mob').fill('Premium');
    await expect(page.locator('#live-search-results-mob').getByText('Premium Gift Box', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/products.html?wishlist=1');
    await expect(page.locator('[data-engagement-id]')).toHaveCount(1);
    await expect(widget).toBeVisible(); // Saved item above the old Rs. 10,000 filter ceiling.
    const secondTab = await context.newPage();
    await secondTab.goto('/products.html');
    await secondTab.locator('[data-engagement-id="901"]').getByRole('button', { name: 'Saved to Wishlist', exact: true }).click();
    await expect(page.getByText('Your wishlist is empty', { exact: true })).toBeVisible();
    await secondTab.close();
    console.log('PASS cross-page state, wishlist retrieval including high-price items, cross-tab removal and empty state');

    await page.goto('/products.html');
    const outOfStock = page.locator('[data-engagement-id="902"]');
    await outOfStock.getByRole('button', { name: 'Add to Wishlist', exact: true }).click();
    await expect(outOfStock.getByRole('button', { name: 'Saved to Wishlist', exact: true })).toBeVisible();
    const card = widget.locator('..').locator('..');
    await card.getByRole('button', { name: 'Add To Cart', exact: true }).click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('rasa-cart'))[0].id), 901);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(widget).toBeVisible();
    assert(await widget.evaluate(el => el.scrollWidth <= el.clientWidth), 'Reaction controls fit mobile card');
    for (const button of await widget.getByRole('button').all()) {
      const box = await button.boundingBox();
      assert(box.x >= 0 && box.x + box.width <= 375, 'Mobile button stays in viewport');
    }
    await page.screenshot({ path: process.env.ENGAGEMENT_SCREENSHOT || path.join(require('node:os').tmpdir(), 'gogo-engagement-mobile.png'), fullPage: true });
    console.log('PASS out-of-stock wishlist, existing cart, mobile controls');

    await page.evaluate(() => {
      localStorage.setItem('gogo-product-preference:v1:901', 'malformed');
    });
    await page.reload();
    await expect(widget.getByRole('button', { name: 'Like', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('Blocked', 'QuotaExceededError'); }; });
    await widget.getByRole('button', { name: 'Like', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Unable to save your choice');
    await expect(widget.getByRole('button', { name: 'Like', exact: true })).toHaveAttribute('aria-pressed', 'false');
    assert.deepEqual(errors, [], 'No browser JavaScript errors');
    console.log('PASS corrupt storage recovery and blocked storage feedback; no JavaScript errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
