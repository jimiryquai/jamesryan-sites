import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { renderFragment, renderPageFragments } from '../src/utils/page-fragments.ts';

test('script attributes escape HTML and reject malformed and event attribute names', () => {
 const html = renderFragment({kind:'inline-script', placement:'head', code:'run();', attributes: {'data-label':'"&<>', id:'plugin', onclick:'bad()', 'x=y':'bad', 'x y':'bad', 'x>':'bad', 'x/':'bad', 'x\u0000':'bad', src:'javascript:bad()'}});
 assert.equal(html, '<script data-label="&quot;&amp;&lt;&gt;" id="plugin">run();</script>');
});

test('script breakout sequences fail closed while ordinary plugin JavaScript executes unchanged', () => {
 for (const code of ['var x="</ScRiPt><img src=x onerror=bad()>";', '<!--\nrun();', 'var x="<script>";']) {
  assert.equal(renderFragment({kind:'inline-script', placement:'head',code}), '');
 }
 const code = 'globalThis.pluginReady = { value: "ok" };';
 const html = renderFragment({kind:'inline-script',placement:'head',code});
 const context = {};
 vm.runInNewContext(html.slice(8,-9), context);
 assert.equal(context.pluginReady.value, 'ok');
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
  {kind:'html',placement:'body-end',html:'end'},
  {kind:'html',placement:'head',html:'first'},
  {kind:'html',placement:'body-start',html:'start'},
  {kind:'html',placement:'head',html:'second'},
 ]), {head:'first\nsecond','body-start':'start','body-end':'end'});
});
