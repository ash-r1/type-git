import { GitArgumentError } from '../../src/core/types.js';
import type { Git } from '../../src/core/git.js';

/** The same behavioral contract runs against Node, Bun, and Deno adapters. */
export async function checkRepositoryContract(git: Git, directory: string, writeFile: (path: string, value: string) => Promise<void>): Promise<void> {
  const check = (condition: boolean, message: string): void => { if (!condition) throw new Error(message); };
  const repo = await git.init(`${directory}/repo`, { initialBranch: 'main' });
  await repo.config.set('user.name', 'Contract test');
  await repo.config.set('user.email', 'test@example.com');
  const filename = '日本語 space.txt';
  await writeFile(`${repo.workdir}/${filename}`, 'content\n');
  check((await repo.status()).entries[0]?.path === filename, 'status must preserve Unicode paths');
  await repo.add(filename);
  check((await repo.diff(undefined, { staged: true, nameOnly: true, patch: true, stat: true }))[0] === filename, 'diff names must be actual strings');
  await repo.commit({ message: 'subject\n\nbody\x01text\n', cleanup: 'verbatim' });
  check((await repo.log())[0]?.body === 'body\x01text\n', 'log must preserve control characters');
  check((await repo.lsTree('HEAD', { nameOnly: true }))[0] === filename, 'lsTree names must preserve Unicode');
  await repo.config.setRaw('test.value', '  multiline\nvalue  ');
  check(await repo.config.getRaw('test.value') === '  multiline\nvalue  ', 'config must preserve whitespace');
  await repo.config.add('user.name', 'Another');
  check((await repo.config.getAll('user.name')).length === 2, 'config must preserve multiple values');
  const controller = new AbortController(); controller.abort();
  let aborted = false;
  try { await repo.config.get('user.name', { signal: controller.signal }); }
  catch (error) { aborted = error instanceof Error && 'kind' in error && error.kind === 'Aborted'; }
  check(aborted, 'config cancellation must propagate as Aborted');
  let invalidDependency = false;
  try { await git.clone(repo.workdir, `${directory}/invalid`, { alsoFilterSubmodules: true } as never); }
  catch (error) { invalidDependency = error instanceof GitArgumentError; }
  check(invalidDependency, 'clone dependencies must be checked before invoking Git');
  const bare = await git.clone(repo.workdir, `${directory}/bare`, { bare: true });
  check(bare.kind === 'bare', 'clone must return a discriminated bare repository');
  check((await bare.lsTree('HEAD', { nameOnly: true }))[0] === filename, 'bare tree parser must match worktree');
  for (const invalidIO of [{ stdin: 42 }, { stdout: 'invalid' }]) {
    let rejected = false;
    try { await repo.command('hash-object', [['--stdin']], invalidIO as never); }
    catch (error) { rejected = error instanceof GitArgumentError; }
    check(rejected, 'malformed command I/O options must be rejected before spawning');
  }
  // Incompressible non-UTF-8 bytes exercise multiple process output chunks and byte views.
  const framed = new Uint8Array(256 * 1024 + 16);
  let random = 0x12345678;
  for (let i = 0; i < framed.length; i++) {
    random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
    framed[i] = random & 255;
  }
  const payload = framed.subarray(8, -8);
  const stored = await repo.command('hash-object', [['-w'], ['--stdin']], { stdin: payload });
  check(stored.exitCode === 0 && !stored.aborted, 'binary object input must be written');
  const oid = stored.stdout.trim();
  const packed = await repo.command('pack-objects', [['--stdout']], { stdin: `${oid}\n`, stdout: 'bytes' });
  check(packed.exitCode === 0 && !packed.aborted && packed.stdout.length > 64 * 1024, 'public pack output must preserve large binary data');
  const indexed = await repo.command('index-pack', [['--stdin']], { stdin: packed.stdout });
  check(indexed.exitCode === 0 && !indexed.aborted, 'public index-pack must consume binary data');
  const unpacked = await repo.command('unpack-objects', [['-n'], ['--strict']], { stdin: packed.stdout });
  check(unpacked.exitCode === 0 && !unpacked.aborted, 'public unpack must validate binary data');
  const blob = await repo.command('cat-file', [['-p'], { operand: oid }], { stdout: 'bytes' });
  check(blob.exitCode === 0 && blob.stdout.length === payload.length && blob.stdout.every((value, i) => value === payload[i]), 'worktree binary stdout must preserve every byte');
  const bareStored = await bare.command('hash-object', [['-w'], ['--stdin']], { stdin: payload });
  check(bareStored.exitCode === 0, 'bare binary input must be written');
  const bareBlob = await bare.command('cat-file', [['-p'], { operand: bareStored.stdout.trim() }], { stdout: 'bytes' });
  check(bareBlob.exitCode === 0 && bareBlob.stdout.length === payload.length && bareBlob.stdout.every((value, i) => value === payload[i]), 'bare binary stdout must preserve every byte');
  const reusedOutputOptions = { stdout: 'bytes' as const, signal: new AbortController().signal };
  const rawText = await repo.raw(['version'], reusedOutputOptions);
  check(typeof rawText.stdout === 'string', 'raw text execution must retain its declared string result');
  const versionBytes = await git.command('version', [], { stdout: 'bytes' });
  const versionText = await git.command('version', []);
  check(versionBytes.exitCode === 0 && new TextDecoder().decode(versionBytes.stdout) === versionText.stdout, 'global binary stdout must use the selected adapter');
  // The configured gitk program is actual Git, exercising companion transport
  // and repository cwd without claiming native GUI execution.
  const companionStored = await repo.command('gitk', [
    { operand: 'hash-object' }, { operand: '-w' }, { operand: '--stdin' },
  ], { stdin: payload });
  check(companionStored.exitCode === 0 && companionStored.stdout.trim() === oid,
    'companion input must preserve the offset byte view and return native text');
  const companionBlob = await repo.command('gitk', [
    { operand: 'cat-file' }, { operand: '-p' }, { operand: oid },
  ], { stdout: 'bytes' });
  check(companionBlob.exitCode === 0 && companionBlob.stdout.length === payload.length
    && companionBlob.stdout.every((value, i) => value === payload[i]),
    'worktree companion output must preserve every non-UTF-8 byte');
  const companionBareBlob = await bare.command('gitk', [
    { operand: 'cat-file' }, { operand: '-p' }, { operand: bareStored.stdout.trim() },
  ], { stdout: 'bytes' });
  check(companionBareBlob.exitCode === 0 && companionBareBlob.stdout.length === payload.length
    && companionBareBlob.stdout.every((value, i) => value === payload[i]),
    'bare companion cwd and byte output must retain the repository context');
  const companionVersion = await git.command('gitk', [{ operand: 'version' }], { stdout: 'bytes' });
  check(companionVersion.exitCode === 0
    && new TextDecoder().decode(companionVersion.stdout) === versionText.stdout,
    'global companion byte output must use the selected runtime adapter');


}
