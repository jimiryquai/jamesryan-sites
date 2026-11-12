import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function runNoOAuth(argv, run = spawnSync) {
  const [config, server, ...input] = argv;
  const args = input.length ? input : ['list'];
  const [command, ...rest] = args;
  const signIn = `pnpm exec mcporter --config ${config} auth ${server}`;

  if (!config || !server || !['list', 'call', 'resource'].includes(command) ||
      rest.some((arg) => arg === '--config' || arg.startsWith('--config=') || arg === '--root' || arg.startsWith('--root='))) {
    console.error('Only list, call and resource operations are supported; agents must not start OAuth.');
    return 1;
  }

  const result = run(process.execPath, [
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
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exitCode = runNoOAuth(process.argv.slice(2));
}
