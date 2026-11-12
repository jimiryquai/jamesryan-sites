import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { registerHooks } from 'node:module';
// Node cannot mock an uncompiled TypeScript package under node_modules.
const pluginHook = registerHooks({ load(url, context, next) {
  if (url.includes('@jdevalk/emdash-plugin-seo/src/index.ts')) return { format: 'module', shortCircuit: true, source: 'export default () => ({ name: "seo" });' };
  if (url.includes('emdash-plugin-code-block-pro/src/index.ts')) return { format: 'module', shortCircuit: true, source: 'export const codeBlockProPlugin = () => ({ name: "code" });' };
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
    assert.deepEqual(config.image.domains, [new URL(site).hostname, `staging.${new URL(site).hostname}`, 'localhost']);
    const emdash = config.integrations.find(item => item.name === 'emdash').options;
    assert.deepEqual(emdash.sandboxed, [sandboxed]);
    assert.equal(emdash.plugins.at(-1), extra);
    assert.equal(emdash.plugins[0].adminEntry, `file:///sites/${port}/node_modules/@jdevalk/emdash-plugin-seo/src/admin.tsx`);
    assert.equal(emdash.plugins[0].entrypoint, `file:///sites/${port}/node_modules/@jdevalk/emdash-plugin-seo/src/index.ts`);
    assert.equal(emdash.database.options.binding, 'DB');
    assert.equal(emdash.storage.options.binding, 'MEDIA');
    assert.equal(emdash.mcp, true);
  }
});
