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
}
