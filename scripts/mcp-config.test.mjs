import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { lstat, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const mcporterCli = join(root, 'node_modules/mcporter/dist/cli.js');

function readRequestBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolveBody(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', rejectBody);
  });
}

async function startFakeMcpServer(expectedAuthHeader) {
  const receivedAuthHeaders = [];
  const server = createServer(async (req, res) => {
    receivedAuthHeaders.push(req.headers.authorization ?? '');
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    if (req.headers.authorization !== expectedAuthHeader) {
      res.writeHead(401, {
        'content-type': 'application/json',
        'www-authenticate': 'Bearer resource_metadata="http://127.0.0.1/.well-known/oauth-protected-resource"',
      });
      res.end(JSON.stringify({ error: 'Authentication required' }));
      return;
    }
    const payload = JSON.parse(await readRequestBody(req));
    res.writeHead(200, { 'content-type': 'application/json' });
    if (payload.method === 'initialize') {
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: payload.id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'fake-emdash', version: '1.0.0' },
        },
      }));
      return;
    }
    if (payload.method === 'notifications/initialized') {
      res.end('');
      return;
    }
    if (payload.method === 'tools/list') {
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: payload.id,
        result: {
          tools: [
            {
              name: 'content_list',
              description: 'List entries',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        },
      }));
      return;
    }
    res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id ?? null, result: {} }));
  });

  await new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const port = server.address().port;
  return {
    port,
    receivedAuthHeaders,
    close() {
      return new Promise((resolveClose) => {
        server.close(() => resolveClose());
      });
    },
  };
}

async function allocateClosedPort() {
  const probe = createServer();
  await new Promise((resolveListen) => {
    probe.listen(0, '127.0.0.1', resolveListen);
  });
  const port = probe.address().port;
  await new Promise((resolveClose) => {
    probe.close(() => resolveClose());
  });
  return port;
}

function cleanMcpEnv() {
  const env = { ...process.env };
  delete env.EMDASH_SITE_PAT;
  delete env.EMDASH_GARDEN_PAT;
  delete env.EMDASH_AGENT_STAGING_TOKEN;
  return env;
}

async function writeLoopbackConfig(sourceConfigPath, urlByServer, destConfigPath) {
  const config = JSON.parse(await readFile(sourceConfigPath, 'utf8'));
  for (const [name, server] of Object.entries(config.mcpServers)) {
    const replacementUrl = urlByServer[name];
    assert.ok(replacementUrl, `missing loopback URL override for ${name}`);
    assert.equal(new URL(replacementUrl).hostname, '127.0.0.1', `${name} test URL must stay on loopback`);
    server.url = replacementUrl;
  }
  await writeFile(destConfigPath, JSON.stringify(config, null, 2));
}

function runMcporterConfig(configPath, envPath, args, cwd) {
  return execFileAsync(
    process.execPath,
    [`--env-file-if-exists=${envPath}`, mcporterCli, '--config', configPath, ...args],
    { cwd, env: cleanMcpEnv() },
  );
}

test('always-loaded .mcp.json points to config/mcporter.json and holds no machine paths, unpinned packages or local/token servers', async () => {
  const linkStat = await lstat(join(root, '.mcp.json'));
  assert.ok(linkStat.isSymbolicLink(), '.mcp.json must remain a symlink to config/mcporter.json');

  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.devDependencies?.mcporter ?? '', /^\d+\.\d+\.\d+$/, 'mcporter must be pinned to an exact version');
  assert.equal(pkg.devDependencies?.['mcp-remote'], undefined, 'mcp-remote should not be needed when direct HTTP transport is used');
  assert.equal(pkg.dependencies?.['mcp-remote'], undefined, 'mcp-remote should not be in dependencies');

  const configDir = join(root, 'config');
  const configFiles = (await readdir(configDir)).filter((name) => /^mcporter.*\.json$/.test(name)).sort();
  assert.ok(configFiles.includes('mcporter.json'), 'config/mcporter.json must exist');

  for (const file of configFiles) {
    const raw = await readFile(join(configDir, file), 'utf8');
    for (const forbidden of ['/home/', '/Users/', 'mise/installs', 'mcp-remote', 'npx ', 'sh -c', '"command"']) {
      assert.ok(!raw.includes(forbidden), `${file} must not contain ${forbidden}`);
    }
    const parsed = JSON.parse(raw);
    assert.deepEqual(parsed.imports, [], `${file} must disable external editor imports for deterministic listings`);
    for (const [name, server] of Object.entries(parsed.mcpServers ?? {})) {
      assert.equal(server.type, 'http', `${file}:${name} must use direct http transport`);
      assert.equal(server.lifecycle, 'ephemeral', `${file}:${name} must use ephemeral lifecycle`);
    }
  }

  const alwaysLoaded = JSON.parse(await readFile(join(configDir, 'mcporter.json'), 'utf8'));
  assert.deepEqual(Object.keys(alwaysLoaded.mcpServers), ['emdash-docs']);
  assert.equal(alwaysLoaded.mcpServers['emdash-docs'].url, 'https://docs.emdashcms.com/mcp');
});

test('on-request local and staging configs isolate dev-server and token-authenticated EmDash MCP endpoints', async () => {
  const staging = JSON.parse(await readFile(join(root, 'config/mcporter.staging.json'), 'utf8'));
  assert.deepEqual(Object.keys(staging.mcpServers), ['emdash-staging-agent']);
  assert.deepEqual(staging.mcpServers['emdash-staging-agent'], {
    type: 'http',
    url: 'https://staging.jamesryan.dev/_emdash/api/mcp',
    headers: {
      Authorization: 'Bearer ${EMDASH_AGENT_STAGING_TOKEN}',
    },
    lifecycle: 'ephemeral',
  });

  const local = JSON.parse(await readFile(join(root, 'config/mcporter.local.json'), 'utf8'));
  assert.deepEqual(Object.keys(local.mcpServers), ['emdash-site', 'emdash-garden']);
  assert.equal(local.mcpServers['emdash-site'].url, 'http://localhost:4321/_emdash/api/mcp');
  assert.equal(local.mcpServers['emdash-site'].headers?.Authorization, 'Bearer ${EMDASH_SITE_PAT}');
  assert.match(local.mcpServers['emdash-site'].description ?? '', /4321.*pnpm dev/);
  assert.equal(local.mcpServers['emdash-garden'].url, 'http://localhost:4322/_emdash/api/mcp');
  assert.equal(local.mcpServers['emdash-garden'].headers?.Authorization, 'Bearer ${EMDASH_GARDEN_PAT}');
  assert.match(local.mcpServers['emdash-garden'].description ?? '', /4322.*pnpm dev:garden/);

  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(
    pkg.scripts?.['mcp:local'],
    'node --env-file-if-exists=.env ./node_modules/mcporter/dist/cli.js --config config/mcporter.local.json',
  );
  assert.equal(
    pkg.scripts?.['mcp:staging'],
    'node --env-file-if-exists=.env ./node_modules/mcporter/dist/cli.js --config config/mcporter.staging.json',
  );
});

test('mcporter loads .env tokens via --env-file-if-exists, reports offline local ports cleanly, and blocks unauthenticated calls', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'mcp-config-seam-'));
  const siteServer = await startFakeMcpServer('Bearer fixture-site-token');
  const stagingProbe = await startFakeMcpServer('Bearer fixture-staging-token');
  const closedGardenPort = await allocateClosedPort();

  try {
    const localConfigPath = join(workDir, 'mcporter.local.json');
    await writeLoopbackConfig(
      join(root, 'config/mcporter.local.json'),
      {
        'emdash-site': `http://127.0.0.1:${siteServer.port}/_emdash/api/mcp`,
        'emdash-garden': `http://127.0.0.1:${closedGardenPort}/_emdash/api/mcp`,
      },
      localConfigPath,
    );

    const envPath = join(workDir, '.env');
    await writeFile(envPath, 'EMDASH_SITE_PAT=fixture-site-token\nEMDASH_GARDEN_PAT=fixture-garden-token\n');

    const localRun = await runMcporterConfig(localConfigPath, envPath, ['list'], workDir);
    assert.match(
      localRun.stdout,
      /- emdash-site — Requires local marketing-site dev server on port 4321 \(pnpm dev\) \(1 tool,/,
    );
    assert.match(
      localRun.stdout,
      /- emdash-garden — Requires local digital-garden dev server on port 4322 \(pnpm dev:garden\) \(offline — unable to reach server,/,
    );
    assert.ok(siteServer.receivedAuthHeaders.length > 0);
    assert.ok(siteServer.receivedAuthHeaders.every((header) => header === 'Bearer fixture-site-token'));

    siteServer.receivedAuthHeaders.length = 0;
    const missingEnvPath = join(workDir, '.env.missing');
    const localWithoutToken = await runMcporterConfig(localConfigPath, missingEnvPath, ['list'], workDir);
    assert.match(localWithoutToken.stdout, /EMDASH_SITE_PAT must be set/);
    assert.equal(siteServer.receivedAuthHeaders.length, 0, 'local server must not be contacted without token');

    const stagingConfigPath = join(workDir, 'mcporter.staging.json');
    await writeLoopbackConfig(
      join(root, 'config/mcporter.staging.json'),
      { 'emdash-staging-agent': `http://127.0.0.1:${stagingProbe.port}/_emdash/api/mcp` },
      stagingConfigPath,
    );

    const stagingWithoutToken = await runMcporterConfig(stagingConfigPath, missingEnvPath, ['list'], workDir);
    assert.match(stagingWithoutToken.stdout, /EMDASH_AGENT_STAGING_TOKEN must be set/);
    assert.equal(stagingProbe.receivedAuthHeaders.length, 0, 'staging server must not be contacted without token');
  } finally {
    await siteServer.close();
    await stagingProbe.close();
    await rm(workDir, { recursive: true, force: true });
  }
});
