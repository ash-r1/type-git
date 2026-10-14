import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [gitInput, lfsInput, cobraInput, ...flags] = process.argv.slice(2);
if (!gitInput || !lfsInput || !cobraInput || flags.some(flag => flag !== '--c-tables')) {
  throw new Error('Usage: node scripts/verify-upstream.mjs <git-2.55.0> <git-lfs-3.8.0> <cobra-1.10.2> [--c-tables]');
}
const git = resolve(gitInput);
const lfs = resolve(lfsInput);
const cobra = resolve(cobraInput);
const root = new URL('../', import.meta.url);
/** Load one repository snapshot for fingerprint and extraction comparison. */
const load = async name => JSON.parse(await readFile(new URL(`spec/upstream/${name}.json`, root), 'utf8'));
const expected = new Map();
/** Collect a source fingerprint, rejecting conflicting records for the same file. */
/** Register a pinned upstream file and reject conflicting fingerprints for that source. */
function add(base, file, digest) {
  const path = join(base, file);
  if (expected.has(path) && expected.get(path) !== digest) throw new Error(`Inconsistent snapshot fingerprints: ${file}`);
  expected.set(path, digest);
}
const inventory = await load('command-inventory');
for (const [path, digest] of Object.entries(inventory.sources)) {
  const [project, ...rest] = path.split('/');
  const base = { git, lfs, cobra }[project];
  if (!base) throw new Error(`Unknown upstream project ${project}`);
  add(base, rest.join('/'), digest);
}
for (const [path, digest] of Object.entries((await load('lfs-options')).sources)) add(lfs, path, digest);
for (const [path, digest] of Object.entries((await load('git-numeric-options')).sources)) add(git, path, digest);
for (const [path, digest] of Object.entries(JSON.parse(await readFile(new URL('spec/git-numeric-callbacks.json', root), 'utf8')).sources)) add(git, path, digest);
for (const [path, digest] of Object.entries(JSON.parse(await readFile(new URL('spec/git-compound-decimals.json', root), 'utf8')).sources)) add(git, path, digest);
for (const [path, digest] of Object.entries(JSON.parse(await readFile(new URL('spec/git-boolean-callbacks.json', root), 'utf8')).sources)) add(git, path, digest);
for (const [path, digest] of Object.entries(JSON.parse(await readFile(new URL('spec/git-string-callbacks.json', root), 'utf8')).sources)) add(git, path, digest);
const tables = await load('git-option-tables');
if (flags.includes('--c-tables')) {
  // C preprocessing is reproducible only on the snapshot's recorded compiler/target.
  const compiler = process.env.TYPE_GIT_SPEC_CC ?? 'cc';
  const version = spawnSync(compiler, ['--version'], { encoding: 'utf8' });
  const target = spawnSync(compiler, ['-dumpmachine'], { encoding: 'utf8' });
  for (const result of [version, target]) {
    if (result.error) throw result.error;
    if (result.status !== 0 || result.signal) throw new Error('Cannot inspect C table compiler profile');
  }
  const numeric = await load('git-numeric-options');
  if (version.stdout.split(/\r?\n/)[0] !== numeric.profile.version || target.stdout.trim() !== numeric.profile.target) {
    throw new Error('Numeric extraction compiler/target differs from its recorded snapshot');
  }
  if (version.stdout.split(/\r?\n/)[0] !== tables.profile.compilerVersion ||
      target.stdout.trim() !== tables.profile.target) {
    throw new Error('C table compiler/target profile differs from the recorded snapshot; run without --c-tables to verify source hashes and non-C snapshots.');
  }
}
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
  await copyFile(new URL('scripts/cobra-completion.mjs', root), join(temp, 'scripts/cobra-completion.mjs'));
  await mkdir(join(temp, 'spec/upstream'), { recursive: true });
  const jobs = [
    [process.execPath, 'import-command-inventory.mjs', [git, lfs, cobra], 'command-inventory'],
    [process.execPath, 'import-lfs-options.mjs', [lfs, cobra], 'lfs-options'],
    ['python3', 'import-revision-options.py', [git], 'git-revision-options'],
    ['python3', 'extract-p4-options.py', [git], 'p4-options'],
    ['python3', 'extract-svn-options.py', [git], 'svn-options'],
  ];
  if (flags.includes('--c-tables')) {
    await copyFile(new URL('scripts/git_numeric_dump.py', root), join(temp, 'scripts/git_numeric_dump.py'));
    jobs.push(['python3', 'import-git-options.py', [git], 'git-option-tables']);
    jobs.push(['python3', 'import-git-numeric-options.py', [git], 'git-numeric-options']);
  }
  for (const [executable, script, args, snapshot] of jobs) {
    const destination = join(temp, 'scripts', script);
    await copyFile(new URL(`scripts/${script}`, root), destination);
    const result = spawnSync(executable, [destination, ...args], { encoding: 'utf8' });
    if (result.error) throw result.error;
    if (result.status !== 0 || result.signal) throw new Error(`${script} failed: ${result.stderr}`);
    const actual = await readFile(join(temp, 'spec/upstream', `${snapshot}.json`), 'utf8');
    const saved = await readFile(new URL(`spec/upstream/${snapshot}.json`, root), 'utf8');
    if (actual !== saved) throw new Error(`${snapshot} extraction differs; C tables additionally require the recorded compiler/target profile.`);
    console.log(`Reproduced ${snapshot} byte for byte.`);
  }
  if (!flags.includes('--c-tables')) console.log('C table source hashes checked; use --c-tables on the recorded compiler/target profile to reproduce preprocessing.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
