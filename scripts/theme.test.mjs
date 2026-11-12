import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function visit(t, { cookie, colorScheme = 'light' } = {}) {
  const context = await browser.newContext({ colorScheme });
  t.after(() => context.close());
  if (cookie) await context.addCookies([{ name: cookie.name ?? 'theme', value: cookie.value, url: 'http://theme.test' }]);
  const source = await readFile(new URL('../packages/ui/src/components/theme-init.js', import.meta.url), 'utf8');
  await context.route('http://theme.test/**', route => route.fulfill({
    contentType: 'text/html',
    body: `<html class="scroll-smooth"><head><script>${source}</script></head><body><script>window.firstBodyTheme = document.documentElement.className;</script></body></html>`,
  }));
  const page = await context.newPage();
  await page.goto('http://theme.test');
  return { page, context };
}

test('head applies a saved light choice before the body even on a dark system', async t => {
  const { page } = await visit(t, { cookie: { value: 'light' }, colorScheme: 'dark' });
  assert.equal(await page.evaluate(() => window.firstBodyTheme), 'scroll-smooth light');
});

test('theme choices update immediately, persist for a year, and system clears the cookie', async t => {
  const { page, context } = await visit(t);
  await page.evaluate(() => window.siteTheme.setPreference('dark'));
  assert.equal(await page.locator('html').getAttribute('class'), 'scroll-smooth dark');
  const [cookie] = await context.cookies();
  assert.equal(cookie.name, 'theme');
  assert.equal(cookie.value, 'dark');
  assert.equal(cookie.path, '/');
  assert.equal(cookie.sameSite, 'Lax');
  assert.ok(Math.abs(cookie.expires - Date.now() / 1000 - 31536000) < 10);
  await page.reload();
  assert.equal(await page.evaluate(() => window.firstBodyTheme), 'scroll-smooth dark');
  await page.evaluate(() => window.siteTheme.setPreference('light'));
  assert.equal(await page.locator('html').getAttribute('class'), 'scroll-smooth light');
  await page.evaluate(() => window.siteTheme.setPreference('system'));
  assert.deepEqual(await context.cookies(), []);
  assert.equal(await page.locator('html').getAttribute('class'), 'scroll-smooth');
  assert.equal(await page.evaluate(() => window.siteTheme.preference), 'system');
});

test('system follows live color scheme changes while explicit choices win, and unrelated cookies are ignored', async t => {
  const { page } = await visit(t, { cookie: { name: 'other_theme', value: 'dark' } });
  await page.addStyleTag({ content: `body { background: white; } @media(prefers-color-scheme:dark) { html:not(.light) body { background: black; } } html.dark body { background: black; }` });
  const background = () => page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor);
  assert.equal(await background(), 'rgb(255, 255, 255)');
  await page.emulateMedia({ colorScheme: 'dark' });
  assert.equal(await background(), 'rgb(0, 0, 0)');
  await page.evaluate(() => window.siteTheme.setPreference('light'));
  assert.equal(await background(), 'rgb(255, 255, 255)');
  await page.evaluate(() => window.siteTheme.setPreference('system'));
  assert.equal(await background(), 'rgb(0, 0, 0)');
  await page.emulateMedia({ colorScheme: 'light' });
  assert.equal(await background(), 'rgb(255, 255, 255)');
});

test('invalid saved values use system without pinning a class', async t => {
  const { page } = await visit(t, { cookie: { value: 'invalid' }, colorScheme: 'dark' });
  assert.equal(await page.evaluate(() => window.siteTheme.preference), 'system');
  assert.equal(await page.evaluate(() => window.firstBodyTheme), 'scroll-smooth');
});
