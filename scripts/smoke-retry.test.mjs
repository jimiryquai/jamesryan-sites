import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';

test('smoke waits for a new domain to become healthy', async () => {
  const attempts = new Map();
  const server = createServer((req, res) => {
    const count = (attempts.get(req.url) ?? 0) + 1;
    attempts.set(req.url, count);
    res.statusCode = count === 1 ? 403 : 200;
    res.end(req.url === '/sitemap.xml' ? '<loc>https://example.com/posts/ready</loc>' : 'ok');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const child = spawn(process.execPath, ['scripts/smoke-staging.mjs', `http://127.0.0.1:${server.address().port}`], {
      env: { ...process.env, SMOKE_TIMEOUT_MS: '1500', SMOKE_RETRY_MS: '10' },
    });
    let output = '';
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => output += data);
    const [code] = await once(child, 'close');
    assert.equal(code, 0, output);
    assert.match(output, /200.*\/posts\/ready/);
  } finally { server.close(); }
});

test('smoke deadline includes stalled responses and reports every URL last result', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/') return; // A new domain can accept a connection without responding.
    res.statusCode = 403;
    res.end('forbidden');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const started = Date.now();
    const child = spawn(process.execPath, ['scripts/smoke-staging.mjs', `http://127.0.0.1:${server.address().port}`], {
      env: { ...process.env, SMOKE_TIMEOUT_MS: '150', SMOKE_RETRY_MS: '10' },
    });
    let output = '';
    child.stderr.on('data', data => output += data);
    const [code] = await once(child, 'close');
    assert.equal(code, 1, output);
    assert.ok(Date.now() - started < 2000, output);
    assert.match(output, /last result for each URL/);
    for (const path of ['/_emdash/admin/login', '/robots.txt', '/llms.txt', '/sitemap.xml']) {
      assert.ok(output.includes(`403 http://127.0.0.1:${server.address().port}${path}`), output);
    }
    assert.match(output, /ERROR http.*:\d+\/:/);
  } finally { server.closeAllConnections(); server.close(); }
});
