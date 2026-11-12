import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSafeExternalHttpUrl } from '../src/safe-html.ts';

test('external project links accept only absolute HTTP URLs without controls', () => {
  assert.equal(toSafeExternalHttpUrl(' https://example.com/work?q=1 '), 'https://example.com/work?q=1');
  assert.equal(toSafeExternalHttpUrl('http://example.com'), 'http://example.com/');
  for (const value of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'mailto:a@b.c', 'file:///tmp/x', '//example.com', '/work', '', null, {}, 'https://exam\nple.com', '\thttps://example.com']) {
    assert.equal(toSafeExternalHttpUrl(value), null, String(value));
  }
});

import { sanitizeDocumentHtml } from '../src/safe-html.ts';
import { readFileSync } from 'node:fs';

test('document sanitizer preserves the seeded privacy policy and safe document vocabulary', () => {
 const seed = JSON.parse(readFileSync(new URL('../../../apps/digital-garden/seed/seed.json', import.meta.url)));
 const documents = JSON.stringify(seed).match(/privacy@company.example/);
 assert.ok(documents);
 function visit(value) {
  if (!value || typeof value !== 'object') return;
  if (value._type === 'marketing.document') assert.equal(sanitizeDocumentHtml(value.content), value.content);
  for (const child of Object.values(value)) visit(child);
 }
 visit(seed);
 const html = '<h1>Title</h1><p>Text &amp; <strong>bold</strong><br /><a href="mailto:privacy@company.example">Email</a></p>';
 assert.equal(sanitizeDocumentHtml(html), html);
});

test('document sanitizer removes active containers, comments, unknown tags and event attributes', () => {
 assert.equal(sanitizeDocumentHtml('<script>alert(1)</script><style>bad</style><iframe>bad</iframe><object>bad</object><svg><a>bad</a></svg><math>bad</math><!--bad--><form><p onclick="bad()">Good</p><input></form><img src=x onerror=bad()><embed src=x><b style="color:red">Bold</b>'), '<p>Good</p><b>Bold</b>');
});

test('document hrefs accept only safe schemes or local destinations after entity decoding', () => {
 for (const href of ['javascript:alert(1)', 'jav&#x61;script:alert(1)', 'java&#10;script:alert(1)', 'javascript&colon;alert(1)', 'data:text/html,x', '//evil.test', '/\\evil.test', '&sol;&sol;evil.test', 'relative', 'file:///tmp/a']) {
  assert.equal(sanitizeDocumentHtml(`<a href="${href}" onclick="bad()" target="_blank">Link</a>`), '<a>Link</a>', href);
 }
 for (const href of ['https://example.com', 'http://example.com', 'mailto:a@b.c', 'tel:+123', '#part', '/path']) {
  assert.equal(sanitizeDocumentHtml(`<a href="${href}">Link</a>`), `<a href="${href}">Link</a>`);
 }
 assert.equal(sanitizeDocumentHtml('<a href="/find?q=&quot;&amp;&lt;&gt;">Find</a>'), '<a href="/find?q=&quot;&amp;&lt;&gt;">Find</a>');
});

test('malformed document markup fails closed and cannot smuggle attributes or tags', () => {
 for (const html of ['<a href="/good" title=">" onclick="bad()">Link</a>', '<a href="/good" href="javascript:bad()">Link</a>']) {
  assert.equal(sanitizeDocumentHtml(html), '<a href="/good">Link</a>');
 }
 assert.equal(sanitizeDocumentHtml('<p>Safe</p><script>unclosed'), '<p>Safe</p>');
 assert.equal(sanitizeDocumentHtml('<p>Safe</p><a href="unterminated'), '<p>Safe</p>');
 assert.equal(sanitizeDocumentHtml('Text < 3 &amp; fine'), 'Text &lt; 3 &amp; fine');
});

test('nested dangerous containers discard all their contents', () => {
 for (const tag of ['svg', 'math', 'object', 'template']) {
  assert.equal(sanitizeDocumentHtml(`<${tag}><${tag}></${tag}><p>Discard</p></${tag}><p>Keep</p>`), '<p>Keep</p>');
  assert.equal(sanitizeDocumentHtml(`<${tag}><${tag} title=">"></${tag}><p>Discard</p></${tag}><p>Keep</p>`), '<p>Keep</p>');
 }
});

test('discarded container boundaries ignore comments, attributes and raw-text children', () => {
 for (const inner of ['<!-- </svg> -->', '<p title="</svg>">Hidden</p>', '<script>const x="</svg>";</script>']) {
  assert.equal(sanitizeDocumentHtml(`<svg>${inner}<p>Discard</p></svg><p>Keep</p>`), '<p>Keep</p>');
 }
});

test('HTML attribute quotes only open at the start of an attribute value', () => {
 assert.equal(sanitizeDocumentHtml("<template><p x=a'b><span y='></template>'></span><p>LEAKED</p></template>"), '');
 assert.equal(sanitizeDocumentHtml("<p x=a'b>Body</p>"), '<p>Body</p>');
});

test('title and legacy raw-text containers hide their complete contents', () => {
 for (const tag of ['title', 'noembed', 'noframes']) {
  assert.equal(sanitizeDocumentHtml(`<${tag}>Hidden</${tag}><p>Visible</p>`), '<p>Visible</p>');
  assert.equal(sanitizeDocumentHtml(`<template><${tag}></template></${tag}><p>LEAKED</p></template>`), '');
 }
});

test('only foreign containers honor an actual self-closing token', () => {
 assert.equal(sanitizeDocumentHtml('<svg viewBox="0 0 10 10" /><p>Body</p>'), '<p>Body</p>');
 assert.equal(sanitizeDocumentHtml('<math /><p>Body</p>'), '<p>Body</p>');
 assert.equal(sanitizeDocumentHtml('<svg><svg /><p>Hidden</p></svg><p>Body</p>'), '<p>Body</p>');
 assert.equal(sanitizeDocumentHtml('<svg><math /><p>Hidden</p></svg><p>Body</p>'), '<p>Body</p>');
 for (const tag of ['script', 'iframe', 'template']) {
  assert.equal(sanitizeDocumentHtml(`<${tag} src="x" /><p>Hidden</p></${tag}><p>After</p>`), '<p>After</p>');
 }
 assert.equal(sanitizeDocumentHtml('<svg attr=value/><p>Hidden</p></svg><p>After</p>'), '<p>After</p>');
});
