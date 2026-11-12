import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const [config, server, ...input] = process.argv.slice(2);
const args = input.length ? input : ['list'];
const [command, ...rest] = args;
const signIn = `pnpm exec mcporter --config ${config} auth ${server}`;

if (!config || !server || !['list', 'call', 'resource'].includes(command) ||
    rest.some((arg) => arg === '--config' || arg.startsWith('--config=') || arg === '--root' || arg.startsWith('--root='))) {
  console.error('Only list, call and resource operations are supported; agents must not start OAuth.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [
  join(import.meta.dirname, '../node_modules/mcporter/dist/cli.js'),
  '--config', config, command, '--no-oauth',
  ...(command === 'list' ? ['--exit-code'] : []),
  ...rest,
], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: { ...process.env, MCPORTER_OAUTH_NO_BROWSER: '1' },
});

if (result.error) {
  console.error(result.error.message);
}
if (result.status !== 0) {
  console.error(`If authorization is required, ask James to run: ${signIn}`);
}
process.exit(result.status ?? 1);
