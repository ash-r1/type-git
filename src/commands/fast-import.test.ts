import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

let root: string;
let repo: WorktreeRepo;
let env: NodeJS.ProcessEnv;
let parserHelp: boolean;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'type-git-fast-import-'));
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
  const help = spawnSync('git', ['fast-import', '-h'], {
    env,
    encoding: 'utf8',
    input: '',
    timeout: 10000,
  });
  expect(help.error).toBeUndefined();
  expect(help.signal).toBeNull();
  expect([0, 129]).toContain(help.status);
  expect(help.stdout + help.stderr).toContain('usage: git fast-import');
  parserHelp = help.status === 0;
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const callbacks: { flag: string; value: string | number; diagnosed: boolean }[] = [
  { flag: '--signed-tags', value: 'bad', diagnosed: true },
  { flag: '--signed-commits', value: 'bad', diagnosed: true },
  { flag: '--date-format', value: 'bad', diagnosed: true },
  { flag: '--depth', value: -1, diagnosed: true },
  { flag: '--depth', value: 8192, diagnosed: true },
  { flag: '--active-branches', value: -1, diagnosed: true },
  { flag: '--cat-blob-fd', value: -1, diagnosed: true },
  { flag: '--cat-blob-fd', value: 2147483648, diagnosed: true },
  { flag: '--active-branches', value: 9007199254740992, diagnosed: false },
  { flag: '--active-branches', value: Number.POSITIVE_INFINITY, diagnosed: true },
  { flag: '--active-branches', value: Number.NaN, diagnosed: true },
  { flag: '--active-branches', value: 1.5, diagnosed: true },
  { flag: '--max-pack-size', value: '9007199254740992', diagnosed: false },
  { flag: '--big-file-threshold', value: '1.5', diagnosed: false },
];
it.for(
  ['-h', '--help', '--help-all'].flatMap((help) => callbacks.map((row) => ({ ...row, help }))),
)('retains native termination before $flag=$value after $help', async ({ flag, value, help }) => {
  const words = ['fast-import', '--quiet', help, `${flag}=${value}`];
  const native = spawnSync('git', ['-C', repo.workdir, ...words], {
    env,
    input: 'done\n',
    encoding: 'utf8',
    timeout: 10000,
  });
  expect(native.error).toBeUndefined();
  expect(native.signal).toBeNull();
  // Manual parsers reject the help word; parse-options prints help before the callback.
  expect(native.status, native.stderr).toBe(parserHelp ? 0 : 128);
  const tokens = [['--quiet'], [help], [flag, value]];
  expect(commandArguments('fast-import', tokens, true)).toEqual(words);
  const actual = await repo.command('fast-import', tokens as never, { stdin: 'done\n' });
  expect(actual.exitCode).toBe(native.status);
});
it.for(
  callbacks.filter((row) => row.diagnosed),
)('keeps reached $flag=$value validation before help', ({ flag, value }) => {
  const native = spawnSync(
    'git',
    ['-C', repo.workdir, 'fast-import', '--quiet', `${flag}=${value}`, '-h'],
    { env, input: 'done\n', encoding: 'utf8', timeout: 10000 },
  );
  expect(native.error).toBeUndefined();
  expect(native.signal).toBeNull();
  expect(native.status).not.toBeNull();
  expect(native.status).not.toBe(0);
  expect(() => commandArguments('fast-import', [['--quiet'], [flag, value], ['-h']], true)).toThrow(
    GitArgumentError,
  );
});
it('preserves ignored tail operands and the NUL representation boundary', async () => {
  const tokens = [['--quiet'], ['-h'], { operand: '--not-a-real-flag' }, { operand: 'unexpected' }];
  const words = ['fast-import', '--quiet', '-h', '--not-a-real-flag', 'unexpected'];
  expect(commandArguments('fast-import', tokens, true)).toEqual(words);
  const native = spawnSync('git', ['-C', repo.workdir, ...words], {
    env,
    input: 'done\n',
    encoding: 'utf8',
    timeout: 10000,
  });
  expect(native.error).toBeUndefined();
  expect(native.signal).toBeNull();
  expect(native.status).toBe(parserHelp ? 0 : 128);
  expect((await repo.command('fast-import', tokens as never, { stdin: 'done\n' })).exitCode).toBe(
    native.status,
  );
  expect(() => commandArguments('fast-import', [['-h'], ['--signed-tags', 'bad\0']], true)).toThrow(
    GitArgumentError,
  );
  expect(() => commandArguments('fast-import', [['-h'], { operand: 'bad\0' }], true)).toThrow(
    GitArgumentError,
  );
});
it('leaves earlier input-feature failures to the native stream parser', async () => {
  const stdin = 'feature type-git-invalid-feature\n';
  const tokens = [['--quiet'], ['-h'], ['--signed-tags', 'bad']];
  const native = spawnSync(
    'git',
    ['-C', repo.workdir, 'fast-import', '--quiet', '-h', '--signed-tags=bad'],
    {
      env,
      input: stdin,
      encoding: 'utf8',
      timeout: 10000,
    },
  );
  expect(native.error).toBeUndefined();
  expect(native.signal).toBeNull();
  expect(native.status).not.toBeNull();
  expect(native.status).not.toBe(0);
  expect(native.stderr).toContain('type-git-invalid-feature');
  const actual = await repo.command('fast-import', tokens as never, { stdin });
  expect(actual.exitCode).toBe(native.status);
  expect(actual.stderr).toContain('type-git-invalid-feature');
});
it('does not turn a help word after the operand boundary into a parser exit', () => {
  const native = spawnSync('git', ['-C', repo.workdir, 'fast-import', '--quiet', '--', '-h'], {
    env,
    input: 'done\n',
    encoding: 'utf8',
    timeout: 10000,
  });
  expect(native.error).toBeUndefined();
  expect(native.signal).toBeNull();
  expect(native.status).not.toBeNull();
  expect(native.status).not.toBe(0);
  expect(() =>
    commandArguments('fast-import', [['--quiet'], ['--'], { operand: '-h' }], true),
  ).toThrow(GitArgumentError);
});
