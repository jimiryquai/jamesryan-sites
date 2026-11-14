import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
// Node cannot mock an uncompiled TypeScript package under node_modules.
const pluginHook = registerHooks({ load(url, context, next) {
  if (url.includes('@jdevalk/emdash-plugin-seo/src/index.ts')) return { format: 'module', shortCircuit: true, source: 'export default () => ({ name: "seo" });' };
  if (url.includes('emdash-plugin-code-block-pro/src/index.ts')) return { format: 'module', shortCircuit: true, source: 'export const codeBlockProPlugin = () => ({ name: "code" });' };
  if (url.includes('emdash-plugin-page-builder/') && /\.[cm]?[jt]s$/.test(url)) return { format: 'module', shortCircuit: true, source: 'export default () => ({ name: "page-builder" });' };
  if (url.includes('emdash-plugin-ai-comment-moderation/')) return { format: 'module', shortCircuit: true, source: 'export default { name: "moderation" };' };
  return next(url, context);
} });
const integration = name => options => ({ name, options });
for (const [path, name] of [
  ['@astrojs/cloudflare', 'cloudflare'], ['@astrojs/react', 'react'],
  ['astro-iconset', 'icons'], ['emdash/astro', 'emdash'],
  ['@tailwindcss/vite', 'tailwind'], ['@jdevalk/astro-seo-graph/integration', 'seoGraph'],
]) mock.module(path, { defaultExport: integration(name) });
mock.module('@emdash-cms/cloudflare', { namedExports: {
  d1: integration('d1'), r2: integration('r2'), sandbox: integration('sandbox'),
} });
mock.module('astro/config', { namedExports: { defineConfig: config => config, fontProviders: { google: () => 'google' } } });
const { createSiteConfig } = await import('../index.mjs');
const appConfigs = await Promise.all(['marketing-site', 'digital-garden'].map(async app => ({
  app, config: (await import(`../../../apps/${app}/astro.config.mjs`)).default,
})));
pluginHook.deregister();

test('shared config preserves deployment differences and resolves plugin assets against each app', () => {
  for (const [site, port, inspectorPort, displayFont, redirects] of [
    ['https://jamesryan.dev', 4321, 9229, { name: 'Instrument Serif', weights: [400], fallbacks: ['serif'] }, undefined],
    ['https://jamesryan.me', 4322, 9230, { name: 'Familjen Grotesk', weights: [400, 500, 600, 700], fallbacks: ['sans-serif'] }, { '/blog': '/' }],
  ]) {
    const appRootUrl = `file:///sites/${port}/astro.config.mjs`;
    const extra = { name: 'page-builder' };
    const sandboxed = { name: 'moderation' };
    process.argv.push('dev');
    let config;
    try { config = createSiteConfig({ site, port, inspectorPort, displayFont, redirects, appRootUrl, extraPlugins: [extra], sandboxedPlugins: [sandboxed] }); }
    finally { process.argv.pop(); }
    assert.equal(config.site, site);
    assert.equal(config.output, 'server');
    assert.equal(config.server.port, port);
    assert.equal(config.adapter.options.inspectorPort, inspectorPort);
    assert.deepEqual(config.redirects, redirects);
    assert.deepEqual(config.fonts[1], { provider: 'google', cssVariable: '--font-display', ...displayFont });
    assert.deepEqual(config.image.domains, [new URL(site).hostname, `staging.${new URL(site).hostname}`, 'localhost', '127.0.0.1']);
    const emdash = config.integrations.find(item => item.name === 'emdash').options;
    assert.deepEqual(emdash.sandboxed, [sandboxed]);
    assert.equal(emdash.plugins.at(-1), extra);
    assert.equal(emdash.plugins[0].adminEntry, `file:///sites/${port}/node_modules/@jdevalk/emdash-plugin-seo/src/admin.tsx`);
    assert.equal(emdash.plugins[0].entrypoint, `file:///sites/${port}/node_modules/@jdevalk/emdash-plugin-seo/src/index.ts`);
    assert.equal(emdash.database.options.binding, 'DB');
    assert.equal(emdash.storage.options.binding, 'MEDIA');
    assert.equal(emdash.mcp, true);
    assert.deepEqual(config.vite.plugins.map(plugin => plugin.name), ['tailwind']);
    assert.deepEqual(config.vite.server.watch.ignored, ['**/.wrangler/**']);
    assert.deepEqual(config.vite.ssr.optimizeDeps.include, [
      'astro-iconset/components', '@jdevalk/astro-seo-graph', '@jdevalk/seo-graph-core', 'clsx/lite', 'workers-og',
    ]);
    assert.deepEqual(config.fonts[0], { provider: 'google', name: 'Inter', cssVariable: '--font-sans', weights: [400, 500, 600, 700, 800], fallbacks: ['sans-serif'] });
    const seo = config.integrations.find(item => item.name === 'seoGraph').options;
    for (const key of ['validateH1', 'validateUniqueMetadata', 'validateImageAlt', 'validateMetadataLength', 'markdownAlternate']) assert.equal(seo[key], true);
    assert.equal(seo.validateInternalLinks.skip('/api/test'), true);
    assert.equal(seo.validateInternalLinks.skip('/_emdash/admin'), true);
    assert.equal(seo.validateInternalLinks.skip('/posts/test'), false);
    assert.deepEqual(config.integrations.find(item => item.name === 'icons').options.include.ph, [
      'sun', 'moon', 'circle-half', 'check', 'chart-bar', 'check-circle', 'clock', 'cloud', 'code',
      'currency-dollar', 'envelope', 'globe', 'heart', 'lifebuoy', 'lightning', 'lock', 'shield-check', 'sparkle', 'star', 'users-three',
    ]);
    assert.equal(createSiteConfig({ site, port, inspectorPort, displayFont, appRootUrl }).adapter.options.inspectorPort, false);
  }
});

test('both app configs delegate platform wiring to the shared factory with only deployment options', () => {
  for (const { app, config } of appConfigs) {
    const source = readFileSync(new URL(`../../../apps/${app}/astro.config.mjs`, import.meta.url), 'utf8');
    assert.match(source, /import \{ createSiteConfig \} from "..\/..\/packages\/astro-config\/index.mjs"/);
    assert.match(source, /export default createSiteConfig\(\{/);
    const topLevelKeys = [...source.matchAll(/^\t(\w+):/gm)].map(match => match[1]);
    assert.deepEqual(topLevelKeys.sort(), (app === 'marketing-site'
      ? ['site', 'port', 'inspectorPort', 'displayFont', 'extraPlugins', 'sandboxedPlugins', 'appRootUrl']
      : ['site', 'port', 'inspectorPort', 'displayFont', 'redirects', 'appRootUrl']).sort());
    assert.equal(config.site, app === 'marketing-site' ? 'https://jamesryan.dev' : 'https://jamesryan.me');
    assert.equal(config.server.port, app === 'marketing-site' ? 4321 : 4322);
    assert.equal(config.adapter.options.inspectorPort, false);
    assert.equal(config.fonts[1].name, app === 'marketing-site' ? 'Instrument Serif' : 'Familjen Grotesk');
    const emdash = config.integrations.find(item => item.name === 'emdash').options;
    assert.deepEqual(emdash.plugins.map(plugin => plugin.name), app === 'marketing-site' ? ['seo', 'code', 'page-builder'] : ['seo', 'code']);
    assert.deepEqual(emdash.sandboxed.map(plugin => plugin.name), app === 'marketing-site' ? ['moderation'] : []);
    assert.deepEqual(config.redirects, app === 'marketing-site' ? undefined : { '/blog': '/' });
    assert.equal(emdash.plugins[0].adminEntry, new URL(`../../../apps/${app}/node_modules/@jdevalk/emdash-plugin-seo/src/admin.tsx`, import.meta.url).href);
  }
});
