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
if (![...paths].some(path => path.startsWith('/posts/') && path !== '/posts/')) {
  throw new Error('Sitemap must contain a published post');
}
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
const summary = [];
const pairs = [];
try {
  for (const mode of ['light', 'dark']) {
    const session = await openAccessibilityPage(browser, origin, mode);
    const { page } = session;
    for (const path of paths) {
      await session.visit(path);
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
        await page.getByRole('button', { name: 'Theme', exact: true }).evaluate(button => button.removeAttribute('aria-label'));
      }
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      const serious = results.violations.filter(issue => ['serious', 'critical'].includes(issue.impact));
      if (process.env.A11Y_PROVE_FAILURE === '1' && path === '/' && !serious.some(issue => issue.id === 'color-contrast' && issue.nodes.some(node => node.target.includes('#contrast-regression-proof')))) {
        throw new Error('Injected contrast regression was not detected');
      }
      failures += serious.length;
      const name = `${mode}-${path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'}`;
      await writeFile(resolve(output, `${name}.json`), JSON.stringify(results, null, 2));
      for (const result of [...results.passes, ...results.violations, ...results.incomplete].filter(result => result.id === 'color-contrast')) {
        for (const node of result.nodes) for (const check of [...node.any, ...node.all, ...node.none]) {
          if (check.data?.contrastRatio !== undefined) pairs.push({ mode, path, target: node.target, ...check.data });
        }
      }
      if (process.env.A11Y_SCREENSHOTS === '1' && (path === '/' || path === '/_emdash/admin/login' || path === [...paths].find(path => path.startsWith('/posts/') && path !== '/posts/'))) {
        await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
      }
      const entry = { mode, path, serious: serious.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) })), incomplete: results.incomplete.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })) };
      summary.push(entry);
      console.log(JSON.stringify({ mode, path, seriousCriticalIssues: serious.length, violations: entry.serious }));
      if (path === '/') {
        if (process.env.A11Y_PROVE_THEME_FAILURE === '1' && !serious.some(issue => issue.id === 'button-name')) {
          throw new Error('Unlabelled Theme button was not detected');
        }
        // The regular page scan covers the closed header; also scan its open menu.
        await page.locator('theme-switcher > button').click();
        await page.getByRole('menu', { name: 'Theme', exact: true }).waitFor();
        const openResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
        const openSerious = openResults.violations.filter(issue => ['serious', 'critical'].includes(issue.impact));
        failures += openSerious.length;
        await writeFile(resolve(output, `${name}-theme-open.json`), JSON.stringify(openResults, null, 2));
        if (process.env.A11Y_SCREENSHOTS === '1') {
          await page.screenshot({ path: resolve(output, `${name}-theme-open.png`), fullPage: true });
        }
        const openEntry = { mode, path, themeMenu: 'open', serious: openSerious.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) })) };
        summary.push(openEntry);
        console.log(JSON.stringify({ mode, path, themeMenu: 'open', seriousCriticalIssues: openSerious.length, violations: openEntry.serious }));
        await page.keyboard.press('Escape');
        if (process.env.A11Y_PROVE_THEME_FAILURE === '1') {
          await page.locator('theme-switcher > button').evaluate(button => button.setAttribute('aria-label', 'Theme'));
        }
      }
    }
    await session.close();
  }
} finally {
  await browser.close();
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2));
  await writeFile(resolve(output, 'contrast-pairs.json'), JSON.stringify(pairs, null, 2));
}
const postPath = [...paths].find(path => path.startsWith('/posts/') && path !== '/posts/');
const commentFieldsOk = await checkCommentFields(origin, postPath, resolve(output, 'comment-fields'));
console.log(JSON.stringify({ seriousCriticalIssues: failures, pageModeChecks: summary.length, commentFields: commentFieldsOk ? "PASS" : "FAIL" }));
process.exitCode = failures || !commentFieldsOk ? 1 : 0;
