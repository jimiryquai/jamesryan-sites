// Exercise the visitor interface against a built, locally seeded marketing worker.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { openAccessibilityPage } from './accessibility-browser.mjs';

const [origin, output = '.scratch/theme'] = process.argv.slice(2);
if (!origin) throw new Error('Usage: node scripts/check-theme.mjs <origin> [output-directory]');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const session = await openAccessibilityPage(browser, origin, 'light', { recordVideo: { dir: output, size: { width: 1440, height: 1000 } } });
  const { page } = session;
  await page.context().clearCookies();
  await session.visit('/');
  const trigger = page.getByRole('button', { name: 'Theme', exact: true });
  await trigger.waitFor({ timeout: 3000 });
  const menu = page.getByRole('menu', { name: 'Theme', exact: true });
  const item = name => page.getByRole('menuitemradio', { name, exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(await item('System').getAttribute('aria-checked'), 'true');
  assert.equal(await item('System').evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('ArrowDown');
  assert.equal(await item('Light').evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('ArrowUp');
  assert.equal(await item('System').evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Home');
  assert.equal(await item('Light').evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('End');
  assert.equal(await item('System').evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('ArrowDown');
  assert.equal(await item('Light').evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  await trigger.click();
  await page.mouse.click(10, 200);
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  console.log('PASS keyboard menu: Enter, arrows, wrapping, Home, End, Escape, Tab and outside click');

  // Capture the class at the first animation frame of each navigation.
  await page.addInitScript(() => requestAnimationFrame(() => {
    window.firstPaintTheme = document.documentElement.className;
  }));
  for (const preference of ['Light', 'Dark', 'System']) {
    await page.emulateMedia({ colorScheme: preference === 'Light' ? 'dark' : 'light' });
    await trigger.click();
    await item(preference).focus();
    await page.keyboard.press('Enter');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    const expectedClass = preference === 'System' ? null : preference.toLowerCase();
    const check = async () => {
      assert.equal(await page.locator('html').evaluate(root => root.classList.contains('dark')), expectedClass === 'dark');
      assert.equal(await page.locator('html').evaluate(root => root.classList.contains('light')), expectedClass === 'light');
      assert.equal(await trigger.getAttribute('aria-describedby'), 'theme-current');
      assert.equal(await page.locator('#theme-current').textContent(), preference);
    };
    await check();
    await page.screenshot({ path: resolve(output, `${preference.toLowerCase()}-chosen.png`) });
    // Navigate to a different content page, then reload it as a returning visitor.
    await session.visit('/posts');
    await check();
    await page.reload({ waitUntil: 'networkidle' });
    await check();
    const firstPaint = await page.evaluate(() => window.firstPaintTheme);
    assert.equal(firstPaint.includes('dark'), expectedClass === 'dark');
    assert.equal(firstPaint.includes('light'), expectedClass === 'light');
    await trigger.click();
    assert.equal(await item(preference).getAttribute('aria-checked'), 'true');
    await page.screenshot({ path: resolve(output, `${preference.toLowerCase()}-reloaded-menu.png`) });
    await page.keyboard.press('Escape');
    console.log(`PASS ${preference}: selected immediately, navigated to /posts, reloaded, correct class at first frame and checked menu state`);
    await session.visit('/');
  }
  const lightBackground = await page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor);
  await page.emulateMedia({ colorScheme: 'dark' });
  const darkBackground = await page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor);
  assert.notEqual(darkBackground, lightBackground);
  assert.equal(await page.evaluate(() => document.cookie.includes('theme=')), false);
  console.log('PASS System: cookie cleared and rendered colors respond to a live system change');
  // Identical SSR regardless of a visitor's theme cookie; no theme Set-Cookie or Vary.
  const responses = await Promise.all(['light', 'dark'].map(async theme => {
    const response = await fetch(origin, { headers: { Cookie: `theme=${theme}` } });
    const html = await response.text();
    assert.match(html, /<html[^>]*class="scroll-smooth"/);
    assert.doesNotMatch(response.headers.get('vary') ?? '', /cookie/i);
    assert.doesNotMatch(response.headers.get('set-cookie') ?? '', /theme=/);
    return { theme, status: response.status, vary: response.headers.get('vary'), root: html.match(/<html[^>]*>/)?.[0] };
  }));
  await writeFile(resolve(output, 'ssr.json'), JSON.stringify(responses, null, 2));
  console.log('PASS SSR: both cookies receive the same unthemed root; no cookie cache variation or server theme cookie');
  await page.setViewportSize({ width: 390, height: 844 });
  await session.visit('/');
  await trigger.click();
  assert.equal(await menu.isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(output, 'mobile-menu.png') });
  console.log('PASS mobile: Theme menu visible with no horizontal overflow at 390px');
  await session.close();
  await page.video().saveAs(resolve(output, 'theme-run.webm'));
  console.log('PASS recorded browser run: theme-run.webm');
} finally {
  await browser.close();
}
