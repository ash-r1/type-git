import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import fixture from '../../test/fixtures/integer-long-prefix-native.json';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

let root: string;
let repo: WorktreeRepo;
let env: NodeJS.ProcessEnv;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'type-git-integer-prefix-'));
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
  // The fixture is pinned LP64 modern evidence; selected source, libc and ABI may differ.
  const selectedDependent =
    /^[ \t\r\n\v\f]*[-+]?0[bB]/.test(String(value)) ||
    /^[ \t\r\n\v\f]*-/.test(String(value)) ||
    ['18446744073709551615', '4294967296', '9007199254740992', '0xffffffffffffffff'].includes(
      String(value),
    );
  if (!selectedDependent) {
    expect(native.status, native.stderr).toBe(row.nativeExit);
  }
  const build = () => commandArguments('fast-import', tokens, true);
  if (native.status !== 0) {
    await expect(
      repo.command('fast-import', tokens as never, { stdin: 'done\n' }),
    ).rejects.toBeInstanceOf(GitArgumentError);
    if (!selectedDependent) {
      expect(build).toThrow(GitArgumentError);
    }
  } else {
    const actual = await repo.command('fast-import', tokens as never, { stdin: 'done\n' });
    expect(actual.exitCode).toBe(0);
    if (!selectedDependent) {
      expect(build()).toEqual(words);
    }
  }
});
