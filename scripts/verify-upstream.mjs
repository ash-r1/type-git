import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [gitInput, lfsInput, ...flags] = process.argv.slice(2);
if (!gitInput || !lfsInput || flags.some(flag => flag !== '--c-tables')) {
  throw new Error('Usage: node scripts/verify-upstream.mjs <git-2.55.0> <git-lfs-3.8.0> [--c-tables]');
}
const git = resolve(gitInput);
const lfs = resolve(lfsInput);
const root = new URL('../', import.meta.url);
const load = async name => JSON.parse(await readFile(new URL(`spec/upstream/${name}.json`, root), 'utf8'));
const expected = new Map();
function add(base, file, digest) {
  const path = join(base, file);
  if (expected.has(path) && expected.get(path) !== digest) throw new Error(`Inconsistent snapshot fingerprints: ${file}`);
  expected.set(path, digest);
}
const inventory = await load('command-inventory');
for (const [path, digest] of Object.entries(inventory.sources)) {
  const [project, ...rest] = path.split('/');
  add(project === 'git' ? git : lfs, rest.join('/'), digest);
}
for (const [path, digest] of Object.entries((await load('lfs-options')).sources)) add(lfs, path, digest);
const tables = await load('git-option-tables');
for (const [path, digest] of Object.entries(tables.headers)) add(git, path, digest);
for (const record of [...tables.files, ...(await load('git-revision-options')).files]) add(git, record.file, record.sha256);
for (const frontend of ['p4', 'svn']) {
  const snapshot = await load(`${frontend}-options`);
  add(git, snapshot.source, snapshot.sha256);
}
for (const [path, digest] of [...expected].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
  const actual = createHash('sha256').update(await readFile(path)).digest('hex');
  if (actual !== digest) throw new Error(`Upstream source fingerprint mismatch: ${path}`);
}
console.log(`Verified ${expected.size} upstream source fingerprints.`);

// Importers write beside their scripts. Copy them to an isolated directory so a
// verification run cannot replace the checked-in snapshots before comparison.
const temp = await mkdtemp(join(tmpdir(), 'type-git-upstream-check-'));
try {
  await mkdir(join(temp, 'scripts'));
  await mkdir(join(temp, 'spec/upstream'), { recursive: true });
  const jobs = [
    [process.execPath, 'import-command-inventory.mjs', [git, lfs], 'command-inventory'],
    [process.execPath, 'import-lfs-options.mjs', [lfs], 'lfs-options'],
    ['python3', 'import-revision-options.py', [git], 'git-revision-options'],
    ['python3', 'extract-p4-options.py', [git], 'p4-options'],
    ['python3', 'extract-svn-options.py', [git], 'svn-options'],
  ];
  if (flags.includes('--c-tables')) jobs.push(['python3', 'import-git-options.py', [git], 'git-option-tables']);
  for (const [executable, script, args, snapshot] of jobs) {
    const destination = join(temp, 'scripts', script);
    await copyFile(new URL(`scripts/${script}`, root), destination);
    const result = spawnSync(executable, [destination, ...args], { encoding: 'utf8' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${script} failed: ${result.stderr}`);
    const actual = await readFile(join(temp, 'spec/upstream', `${snapshot}.json`), 'utf8');
    const saved = await readFile(new URL(`spec/upstream/${snapshot}.json`, root), 'utf8');
    if (actual !== saved) throw new Error(`${snapshot} extraction differs; C tables additionally require the recorded compiler/target profile.`);
    console.log(`Reproduced ${snapshot} byte for byte.`);
  }
  if (!flags.includes('--c-tables')) console.log('C table source hashes checked; use --c-tables on the recorded compiler/target profile to reproduce preprocessing.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
