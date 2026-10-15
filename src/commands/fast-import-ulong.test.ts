import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import fixture from '../../test/fixtures/fast-import-ulong-native.json';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

let root: string;
let repo: WorktreeRepo;
let env: NodeJS.ProcessEnv;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'type-git-import-ulong-'));
  env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')),
    ),
    HOME: root,
    XDG_CONFIG_HOME: root,
    GIT_CONFIG_GLOBAL: join(root, 'no-config'),
    GIT_CONFIG_NOSYSTEM: '1',
    LC_ALL: 'C',
  };
  repo = await new TypeGit({ inheritEnv: false, env }).init(join(root, 'repo'));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});
it.for(fixture.cases)('matches native $flag ($valueKind: $valueText)', async (row) => {
  const value =
    row.valueKind === 'number'
      ? Number(row.valueText)
      : row.valueKind === 'bigint'
        ? BigInt(row.valueText)
        : row.valueText;
  const words = ['fast-import', '--quiet', `${row.flag}=${String(value)}`];
  const tokens = [['--quiet'], [row.flag, value]];
  const native = spawnSync('git', ['-C', repo.workdir, ...words], {
    env,
    input: 'done\n',
    encoding: 'utf8',
    timeout: 10000,
  });
  expect(native.error).toBeUndefined();
  expect(native.signal).toBeNull();
  expect(native.status).not.toBeNull();
  const binaryPrefix = /^[ \t\r\n\v\f]*\+?0[bB][01]+$/.test(String(value));
  if (row.nativeExit === 0 && binaryPrefix && native.status !== 0) {
    // A non-C23 runtime can reject this portable grammar arm; preserve its actual failure.
    expect(native.status).toBe(128);
    expect(native.stderr).toContain('non-negative integer');
  } else {
    expect(native.status, native.stderr).toBe(row.nativeExit);
  }
  const build = () => commandArguments('fast-import', tokens, true);
  if (row.nativeExit !== 0) {
    expect(build).toThrow(GitArgumentError);
    await expect(
      repo.command('fast-import', tokens as never, { stdin: 'done\n' }),
    ).rejects.toBeInstanceOf(GitArgumentError);
  } else {
    expect(build()).toEqual(words);
    const actual = await repo.command('fast-import', tokens as never, { stdin: 'done\n' });
    expect(actual.exitCode).toBe(native.status);
  }
});
it('rejects a reached invalid value before overwrite/help and preserves NUL guards', () => {
  for (const flag of ['--active-branches', '--depth', '--cat-blob-fd']) {
    const native = spawnSync(
      'git',
      ['-C', repo.workdir, 'fast-import', `${flag}=bad`, `${flag}=1`, '-h'],
      { env, input: 'done\n', encoding: 'utf8', timeout: 10000 },
    );
    expect(native.error).toBeUndefined();
    expect(native.signal).toBeNull();
    expect(native.status).toBe(128);
    expect(() => commandArguments('fast-import', [[flag, 'bad'], [flag, 1], ['-h']], true)).toThrow(
      GitArgumentError,
    );
    expect(() => commandArguments('fast-import', [['-h'], [flag, '1\0']], true)).toThrow(
      GitArgumentError,
    );
  }
});
