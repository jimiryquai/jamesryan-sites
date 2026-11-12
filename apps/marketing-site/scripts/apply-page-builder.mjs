import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getOfferedBlocks } from '../src/components/page-builder/offered-blocks.mjs';

/** Invoke the package bin with the same selection the renderer and seed use. */
export function main(argv, { run = spawnSync, out = console.log, err = console.error } = {}) {
  try {
    if (argv.some((arg) => arg === '--types' || arg.startsWith('--types='))) {
      throw new Error('Set the offered-blocks.json list instead of passing --types');
    }
    const types = getOfferedBlocks().map((block) => block.definition.slug).join(',');
    const bin = fileURLToPath(new URL('../node_modules/.bin/emdash-page-builder', import.meta.url));
    const result = run(bin, ['apply', ...argv, '--types', types], { encoding: 'utf8', env: process.env });
    if (result.error) throw result.error;
    if (result.stdout) out(result.stdout.trimEnd());
    if (result.stderr) err(result.stderr.trimEnd());
    if (result.status === null) throw new Error(`Page builder CLI terminated with signal ${result.signal}`);
    return result.status;
  } catch (error) {
    out(JSON.stringify({ errors: [{ message: error.message }] }));
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
