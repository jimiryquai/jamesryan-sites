import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { renderFragment, renderPageFragments } from '../src/utils/page-fragments.ts';

test('script attributes escape HTML and reject malformed and event attribute names', () => {
 const html = renderFragment({kind:'inline-script', placement:'head', code:'run();', attributes: {'data-label':'"&<>', id:'plugin', onclick:'bad()', 'x=y':'bad', 'x y':'bad', 'x>':'bad', 'x/':'bad', 'x\u0000':'bad', src:'javascript:bad()'}});
 assert.equal(html, '<script data-label="&quot;&amp;&lt;&gt;" id="plugin">run();</script>');
});

test('inline JSON preserves titles mentioning script tags without raw closing tags', () => {
 const value = {title:'How <script defer> and </script> work'};
 const html = renderFragment({kind:'inline-script',placement:'head',attributes:{type:'application/json'},code:JSON.stringify(value)});
 const payload = html.slice(html.indexOf('>')+1,-9);
 assert.deepEqual(JSON.parse(payload), value);
 assert.doesNotMatch(payload, /<\/script/i);
});

test('inline scripts escape breakout strings and execute unchanged', () => {
 const code = 'globalThis.title = "</ScRiPt><img src=x onerror=alert(1)>";';
 const html = renderFragment({kind:'inline-script',placement:'head',code});
 const payload = html.slice(8,-9);
 assert.doesNotMatch(payload, /<\/script/i);
 assert.ok(payload.includes('<\\/ScRiPt>'));
 const context = {};
 vm.runInNewContext(payload, context);
 assert.equal(context.title, '</ScRiPt><img src=x onerror=alert(1)>');
});

test('only unclosed HTML comment segments fail closed', () => {
 for (const code of ['<!-- <script>', '<!--unclosed', '<!--closed--><!--<script>']) {
  assert.equal(renderFragment({kind:'inline-script',placement:'head',code}), '');
 }
 for (const code of ['var x="<script>";', '<!-- <script> -->\nvar x=1;', '<!-- comment -->\nvar x=1;']) {
  assert.equal(renderFragment({kind:'inline-script',placement:'head',code}), `<script>${code}</script>`);
 }
});

test('external script sources are escaped and restricted to web or local paths', () => {
 assert.equal(renderFragment({kind:'external-script',placement:'head',src:'/plugin.js?q="&<>',async:true,defer:true, attributes:{integrity:'sha256-test',crossorigin:'anonymous'}}), '<script src="/plugin.js?q=&quot;&amp;&lt;&gt;" async defer integrity="sha256-test" crossorigin="anonymous"></script>');
 for (const src of ['javascript:alert(1)','data:text/javascript,x','vbscript:x','//evil.test/a','/\\evil.test/a','\\evil.test/a','https://exam\nple.com/x']) {
  assert.equal(renderFragment({kind:'external-script',placement:'head',src}), '', src);
 }
 for (const src of ['https://example.com/a.js','http://example.com/a.js','plugin.js','../plugin.js']) {
  assert.ok(renderFragment({kind:'external-script',placement:'head',src}).includes('src="'));
 }
});

test('all three placement groups preserve contribution order and trusted HTML', () => {
 assert.deepEqual(renderPageFragments([
  {kind:'html',placement:'body:end',html:'end'},
  {kind:'html',placement:'head',html:'first'},
  {kind:'html',placement:'body:start',html:'start'},
  {kind:'html',placement:'head',html:'second'},
 ]), {head:'first\nsecond','body:start':'start','body:end':'end'});
});


test('placements deduplicate by key and source per EmDash contract and omit rejected fragments', () => {
 assert.deepEqual(renderPageFragments([
  {kind:'html',placement:'head',key:'a',html:'first'},
  {kind:'html',placement:'head',key:'a',html:'duplicate'},
  {kind:'html',placement:'body:start',key:'a',html:'start'},
  {kind:'external-script',placement:'body:end',src:'/plugin.js'},
  {kind:'external-script',placement:'body:end',src:'/plugin.js'},
  {kind:'external-script',placement:'body:end',src:'javascript:bad()'},
 ]), {head:'first','body:start':'start','body:end':'<script src="/plugin.js"></script>'});
});
