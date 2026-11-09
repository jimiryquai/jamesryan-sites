import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const [app = 'apps/marketing-site', selectedSeed, selectedState] = process.argv.slice(2);
const appDirectory = resolve(app);
const config = JSON.parse(await readFile(join(appDirectory, 'dist/server/wrangler.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(appDirectory, 'package.json'), 'utf8'));
const seedPath = selectedSeed ? resolve(selectedSeed) : resolve(appDirectory, manifest.emdash.seed);
const stateDirectory = selectedState ? resolve(selectedState) : join(appDirectory, '.wrangler/state');
const bucket = config.r2_buckets.find(bucket => bucket.binding === 'MEDIA')?.bucket_name;
if (!bucket) throw new Error('Built Worker has no MEDIA bucket; run pnpm build first');
function run(args) {
  const result = spawnSync('pnpm', ['exec', ...args], {
    cwd: appDirectory, stdio: ['ignore', 2, 2],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', ASTRO_TELEMETRY_DISABLED: '1' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${args[0]} failed (exit ${result.status}, signal ${result.signal})`);
}
run(['wrangler', 'd1', 'execute', 'DB', '--local', '--persist-to', stateDirectory, '--command', 'SELECT 1']);
const databaseDirectory = join(stateDirectory, 'v3/d1');
const databases = (await readdir(databaseDirectory, { recursive: true }))
  .filter(file => file.endsWith('.sqlite') && !file.endsWith('metadata.sqlite'));
if (databases.length !== 1) throw new Error(`Expected one local D1 database, found ${databases.length}`);
const database = join(databaseDirectory, databases[0]);
// Keep staged uploads so a failed R2 copy can be repaired by rerunning.
const uploads = join(stateDirectory, 'seed-uploads');
await mkdir(uploads, { recursive: true });
{
  run(['emdash', 'seed', seedPath, '--database', database, '--uploads-dir', uploads]);
  const db = new DatabaseSync(database);
  let media;
  try { media = db.prepare('SELECT id, filename, storage_key, mime_type, alt, caption, width, height FROM media').all(); }
  finally { db.close(); }
  // On a rerun, EmDash reuses existing rows and writes no new upload for them.
  const files = new Set(await readdir(uploads));
  for (const row of media) {
    if (!files.has(row.storage_key)) continue;
    run(['wrangler', 'r2', 'object', 'put', `${bucket}/${row.storage_key}`, '--file', join(uploads, row.storage_key),
      '--content-type', row.mime_type, '--local', '--persist-to', stateDirectory]);
  }
  console.log(JSON.stringify({ database, stateDirectory, seedPath, bucket, media }, null, 2));
}
