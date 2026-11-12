import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSiteIdentity } from '../src/site-identity.ts';

test('identity uses CMS values and derives a normalized URL from the deployment', () => {
  const logo = { mediaId: 'logo', url: '/logo.svg' };
  assert.deepEqual(resolveSiteIdentity({ title: 'Garden', tagline: 'Notes', logo }, {
    site: new URL('https://garden.example///'), requestUrl: new URL('http://localhost:4322'),
  }), { siteTitle: 'Garden', siteTagline: 'Notes', siteLogo: logo, siteUrl: 'https://garden.example' });
});

test('identity fills empty settings and uses request origin before the final default', () => {
  const identity = resolveSiteIdentity({ title: '', tagline: '' }, { requestUrl: new URL('http://localhost:4322/path') });
  assert.equal(identity.siteTitle, 'James Ryan');
  assert.ok(identity.siteTagline.length >= 50);
  assert.equal(identity.siteUrl, 'http://localhost:4322');
  assert.equal(identity.siteLogo, null);
  assert.equal(resolveSiteIdentity().siteUrl, 'https://jamesryan.dev');
});
