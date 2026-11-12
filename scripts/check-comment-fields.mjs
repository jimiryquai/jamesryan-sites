import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { openAccessibilityPage } from './accessibility-browser.mjs';

export async function checkCommentFields(origin, postPath, output = '.scratch/comment-fields') {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const mode of ['light', 'dark', 'system-dark']) {
      const session = await openAccessibilityPage(browser, origin, mode);
      const { page } = session;
      await session.visit(postPath);
      const fields = page.locator('.article-comments .ec-comment-form-field input:visible, .article-comments .ec-comment-form-field textarea:visible');
      if (await fields.count() !== 3) throw new Error('Expected name, email and comment fields');
      for (const field of await fields.all()) {
        const before = await field.evaluate(element => {
          const style = getComputedStyle(element);
          return { name: element.name, fill: style.backgroundColor, border: style.borderTopColor, text: style.color, page: getComputedStyle(document.body).backgroundColor };
        });
        await field.focus();
        const focus = await field.evaluate((element, before) => {
          const style = getComputedStyle(element);
          // Canvas resolves all supported CSS colour spaces to sRGB before WCAG luminance.
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const luminance = color => {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = getComputedStyle(document.body).backgroundColor; ctx.fillRect(0, 0, 1, 1);
            ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
            const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
              const v = value / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            });
            return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
          };
          const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
          const bg = getComputedStyle(document.body).backgroundColor;
          if (bg === "rgba(0, 0, 0, 0)") throw new Error("Expected opaque page background; check stylesheets loaded");
          return { outline: style.outlineColor, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth,
            borderPageRatio: contrast(before.border, bg),
            focusPageRatio: contrast(style.outlineColor, bg), textFillRatio: contrast(style.color, style.backgroundColor) };
        }, before);
        const ok = before.fill !== before.page && focus.borderPageRatio >= 3 && focus.focusPageRatio >= 3 && focus.textFillRatio >= 4.5 && focus.outlineStyle !== 'none' && parseFloat(focus.outlineWidth) >= 2;
        results.push({ mode, ...before, ...focus, ok });
        console.log(JSON.stringify({ mode, name: before.name, result: ok ? "PASS" : "FAIL", ...focus }));
      }
      await page.locator('.article-comments').screenshot({ path: `${output}/${mode}-comments.png` });
      await session.close();
    }
  } finally {
    await browser.close();
    await writeFile(`${output}/contrast.json`, JSON.stringify(results, null, 2));
  }
  return results.every(result => result.ok);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [origin, postPath, output] = process.argv.slice(2);
  if (!origin || !postPath) throw new Error('Usage: node scripts/check-comment-fields.mjs <origin> <post-path> [output-directory]');
  process.exitCode = await checkCommentFields(origin, postPath, output) ? 0 : 1;
}
