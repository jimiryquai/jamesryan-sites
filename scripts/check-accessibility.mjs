import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkCommentFields } from './check-comment-fields.mjs';

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
    const context = await browser.newContext({ colorScheme: mode, viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: 'theme', value: mode, url: origin }]);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === origin || ['data:', 'blob:', 'about:'].includes(url.protocol)
        ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const stylesheetErrors = [];
    page.on('response', response => {
      if (response.request().resourceType() === 'stylesheet' && !response.ok()) stylesheetErrors.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', request => {
      if (request.resourceType() === 'stylesheet') stylesheetErrors.push(request.url());
    });
    for (const path of paths) {
      const response = await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw new Error(`${mode} ${path}: HTTP ${response?.status()}`);
      await page.evaluate(() => document.fonts.ready);
      if (stylesheetErrors.length) throw new Error(`Stylesheets failed to load: ${stylesheetErrors.join(', ')}`);
      // Evidence-only fault injection: proves the real rendered check can reject a regression.
      if (process.env.A11Y_PROVE_FAILURE === '1' && path === '/') {
        await page.addStyleTag({ content: 'h1 { color: #aaa !important; background: #fff !important; }' });
      }
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      const serious = results.violations.filter(issue => ['serious', 'critical'].includes(issue.impact));
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
      console.log(`${mode} ${path}: ${serious.length} serious/critical issues`);
      if (serious.length) console.log(JSON.stringify(entry.serious));
    }
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2));
  await writeFile(resolve(output, 'contrast-pairs.json'), JSON.stringify(pairs, null, 2));
}
const postPath = [...paths].find(path => path.startsWith('/posts/') && path !== '/posts/');
const commentFieldsOk = await checkCommentFields(origin, postPath, resolve(output, 'comment-fields'));
console.log(`Accessibility: ${failures} serious/critical issues across ${summary.length} page/mode checks; comment fields ${commentFieldsOk ? "PASS" : "FAIL"}`);
process.exitCode = failures || !commentFieldsOk ? 1 : 0;
