import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkCommentFields } from './check-comment-fields.mjs';
import { openAccessibilityPage } from './accessibility-browser.mjs';

// Scan the public sitemap as well as the login page, which is deliberately unlisted.
const [originArg, output = '.scratch/accessibility'] = process.argv.slice(2);
if (!originArg) throw new Error('Usage: node scripts/check-accessibility.mjs <origin> [output-directory]');
const origin = new URL(originArg).origin;
const sitemap = await fetch(`${origin}/sitemap.xml`);
if (!sitemap.ok) throw new Error(`Sitemap returned ${sitemap.status}`);
const paths = new Set(['/', '/_emdash/admin/login', '/search']);
for (const [, loc] of (await sitemap.text()).matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)) {
  const url = new URL(loc.trim());
  paths.add(url.pathname + url.search);
}
const postPath = [...paths].find(path => path.startsWith('/posts/') && path !== '/posts/');
if (!postPath) throw new Error('Sitemap must contain a published post');
// Search for the first post's own title so result snippets (and their <mark>
// highlights) render and get their contrast scanned, on every seeded site.
const postResponse = await fetch(new URL(postPath, origin));
if (!postResponse.ok) throw new Error(`Post page returned ${postResponse.status}`);
const postTitle = (await postResponse.text())
  .match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]
  ?.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
if (!postTitle) throw new Error('Could not read the first post title to search for');
const searchedPath = `/search?q=${encodeURIComponent(postTitle.split(' ').slice(0, 6).join(' '))}`;
paths.add(searchedPath);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
const summary = [];
const pairs = [];

async function scanPage(page, mode, path, themeMenu = 'closed') {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const serious = results.violations.filter(issue => ['serious', 'critical'].includes(issue.impact));
  failures += serious.length;
  const name = `${mode}-${path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'}${themeMenu === 'open' ? '-theme-open' : ''}`;
  await writeFile(resolve(output, `${name}.json`), JSON.stringify(results, null, 2));
  for (const result of [...results.passes, ...results.violations, ...results.incomplete].filter(result => result.id === 'color-contrast')) {
    for (const node of result.nodes) for (const check of [...node.any, ...node.all, ...node.none]) {
      if (check.data?.contrastRatio !== undefined) pairs.push({ mode, path, themeMenu, target: node.target, ...check.data });
    }
  }
  if (process.env.A11Y_SCREENSHOTS === '1' && (path === '/' || path === '/_emdash/admin/login' || path === [...paths].find(path => path.startsWith('/posts/') && path !== '/posts/'))) {
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
  }
  const entry = { mode, path, themeMenu, serious: serious.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) })), incomplete: results.incomplete.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })) };
  summary.push(entry);
  console.log(JSON.stringify({ mode, path, themeMenu, seriousCriticalIssues: serious.length, violations: entry.serious }));
  return serious;
}
try {
  for (const mode of ['light', 'dark', 'system-dark']) {
    const session = await openAccessibilityPage(browser, origin, mode);
    const { page } = session;
    // Cookie-less system dark is verified where the class-based dark CSS lives:
    // the post and search pages (the full sweep covers the cookie modes).
    const modePaths = mode === 'system-dark'
      ? [...paths].filter(path => path.startsWith('/posts/') || path.startsWith('/search'))
      : paths;
    try {
      for (const path of modePaths) {
        await session.visit(path);
        // Snippet <mark> contrast is the point of the queried search URL; an
        // empty result page would scan nothing and silently pass.
        if (path === searchedPath && !(await page.locator('.result-snippet mark').count())) {
          throw new Error(`${mode} ${searchedPath}: no <mark> rendered, snippet contrast was not exercised`);
        }
        // Evidence-only fault injection: proves the real rendered check can reject a regression.
        if (process.env.A11Y_PROVE_FAILURE === '1' && path === '/') {
          await page.evaluate(() => {
            const proof = document.createElement('p');
            proof.id = 'contrast-regression-proof';
            proof.textContent = 'Contrast regression proof';
            proof.style.cssText = 'position:fixed;top:200px;left:20px;z-index:2147483647;padding:20px;background:#fff;color:#aaa;font:16px sans-serif';
            document.body.append(proof);
          });
        }
        if (process.env.A11Y_PROVE_THEME_FAILURE === '1' && path === '/') {
          await page.getByRole('button', { name: 'Theme', exact: true }).evaluate(button => {
            button.id = 'theme-label-regression-proof';
            button.removeAttribute('aria-label');
          });
        }
        const serious = await scanPage(page, mode, path);
        if (process.env.A11Y_PROVE_FAILURE === '1' && path === '/' && !serious.some(issue => issue.id === 'color-contrast' && issue.nodes.some(node => node.target.includes('#contrast-regression-proof')))) {
          throw new Error('Injected contrast regression was not detected');
        }
        if (path === '/') {
          if (process.env.A11Y_PROVE_THEME_FAILURE === '1' && !serious.some(issue => issue.id === 'button-name' && issue.nodes.some(node => node.target.includes('#theme-label-regression-proof')))) {
            throw new Error('Unlabelled Theme button was not detected');
          }
          // The regular page scan covers the closed header; also scan its open menu.
          await page.locator('theme-switcher > button').click();
          await page.getByRole('menu', { name: 'Theme', exact: true }).waitFor();
          await scanPage(page, mode, path, 'open');
          await page.keyboard.press('Escape');
          if (process.env.A11Y_PROVE_THEME_FAILURE === '1') {
            await page.locator('theme-switcher > button').evaluate(button => {
              button.setAttribute('aria-label', 'Theme');
              button.removeAttribute('id');
            });
          }
        }
      }
    } finally {
      await session.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2));
  await writeFile(resolve(output, 'contrast-pairs.json'), JSON.stringify(pairs, null, 2));
}
const commentFieldsOk = await checkCommentFields(origin, postPath, resolve(output, 'comment-fields'));
console.log(JSON.stringify({ seriousCriticalIssues: failures, pageModeChecks: summary.length, commentFields: commentFieldsOk ? "PASS" : "FAIL" }));
process.exitCode = failures || !commentFieldsOk ? 1 : 0;
