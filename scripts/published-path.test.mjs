import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageMarkdownPath, publishedEntryPath } from './published-path.mjs';

test('home markdown is /home.md and every other page follows getContentPath', () => {
  assert.equal(pageMarkdownPath('home'), '/home.md');
  assert.equal(pageMarkdownPath('about'), '/about.md');
  assert.equal(pageMarkdownPath('privacy-policy'), '/privacy-policy.md');
  assert.equal(pageMarkdownPath('fixture-page'), '/pages/fixture-page.md');
  assert.equal(pageMarkdownPath('fixture page'), '/pages/fixture%20page.md');
});

test('published entry paths come from getContentPath for pages, posts and projects', () => {
  assert.equal(publishedEntryPath('pages', 'home'), '/');
  assert.equal(publishedEntryPath('pages', 'fixture-page'), '/pages/fixture-page');
  assert.equal(publishedEntryPath('posts', 'fixture-post'), '/posts/fixture-post');
  assert.equal(publishedEntryPath('projects', 'fixture project'), '/projects/fixture%20project');
  assert.equal(publishedEntryPath('faqs', 'fixture-faq'), '/faqs/fixture-faq');
});
