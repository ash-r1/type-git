import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import { parseGitDecimal } from '../constraints/git-decimal.js';
import { GitArgumentError } from '../core/types.js';

const inputs = [
  {
    flag: '-d',
    values: [
      '4suffix',
      ' 4',
      '+4',
      '04',
      '4294967300',
      '-4294967292',
      '4',
      4,
      '3suffix',
      '9suffix',
      '2suffix',
      '10suffix',
      3.5,
      '4\tignored',
    ],
  },
  {
    flag: '-f',
    values: [
      '5suffix',
      'garbage',
      '',
      ' 5',
      '+5',
      '05',
      '0x5',
      '-2',
      '2147483647',
      '4294967301',
      '-4294967291',
      '5',
      5,
      9007199254740992,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      5.5,
    ],
  },
];
const cases = inputs.flatMap(({ flag, values }) =>
  values.map((value) => ({ flag, value, label: `${flag}${String(value)}` })),
);
for (const value of [
  `${'0'.repeat(160)}4suffix`,
  `${'0'.repeat(160)}2suffix`,
  '9'.repeat(160),
  `-${'9'.repeat(160)}`,
  `${'\t\r\n\v\f '.repeat(30)}4suffix`,
]) {
  for (const flag of ['-d', '-f']) {
    cases.push({ flag, value, label: `${flag} long prefix ${value.slice(-8)}` });
  }
}

/** Capture actual message files as well as native status; argv acceptance alone is insufficient. */
async function messages(directory: string) {
  const result = [];
  for (const name of (await readdir(directory)).sort()) {
    result.push({ name, contents: await readFile(join(directory, name), 'utf8') });
  }
  return result;
}

it.for(cases)('matches native mailsplit prefix conversion and output files for $label', async ({
  flag,
  value,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'type-git-mailsplit-prefix-'));
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')),
    ),
    HOME: root,
    XDG_CONFIG_HOME: root,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: join(root, 'missing'),
    LC_ALL: 'C',
  };
  const stdin = 'From: Audit <audit@example.invalid>\nSubject: audit\n\nbody\n';
  try {
    const nativeDir = join(root, 'native');
    const actualDir = join(root, 'actual');
    await mkdir(nativeDir);
    await mkdir(actualDir);
    const input = join(root, 'message');
    await writeFile(input, stdin);
    // A regular input descriptor avoids EPIPE races when native option parsing exits early.
    const fd = openSync(input, 'r');
    let native: SpawnSyncReturns<string>;
    try {
      native = spawnSync('git', ['mailsplit', '-b', `${flag}${String(value)}`, `-o${nativeDir}`], {
        cwd: root,
        env,
        encoding: 'utf8',
        timeout: 10000,
        stdio: [fd, 'pipe', 'pipe'],
      });
    } finally {
      closeSync(fd);
    }
    expect(native.error).toBeUndefined();
    expect(native.signal).toBeNull();
    expect(native.status).not.toBeNull();
    const operation = new TypeGit({ inheritEnv: false, env }).command(
      'mailsplit',
      [['-b'], [flag, value], ['-o', actualDir]] as never,
      { stdin },
    );
    if (native.status === 129) {
      expect(flag).toBe('-d');
      expect(native.stderr).toContain('usage: git mailsplit');
      await expect(operation).rejects.toBeInstanceOf(GitArgumentError);
      expect(await readdir(nativeDir)).toEqual([]);
      expect(await readdir(actualDir)).toEqual([]);
    } else {
      // An accepted -f can produce a negative split count, including after C int
      // overflow on a selected ABI. Preserve the native result and written file.
      expect([0, 1]).toContain(native.status);
      if (native.status === 1) {
        expect(flag).toBe('-f');
        expect(native.stderr).toContain('cannot split patches from stdin');
      }
      const actual = await operation;
      expect(actual.exitCode).toBe(native.status);
      expect(actual.stdout).toBe(native.stdout);
      expect(actual.stderr).toBe(native.stderr);
      expect(await messages(actualDir)).toEqual(await messages(nativeDir));
      expect(await readdir(nativeDir)).toHaveLength(1);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('keeps strtol prefix conversion separate from checked and atoi number policies', () => {
  const parser = {
    kind: 'decimal',
    longBits: 64,
    bits: 32,
    signed: true,
    conversion: 'prefix-cast',
    empty: true,
  } as const;
  expect(parseGitDecimal('4294967300suffix', parser, undefined, 64)).toEqual({
    valid: true,
    value: 4,
  });
  expect(parseGitDecimal('4294967300suffix', parser, undefined, 32)).toEqual({
    valid: true,
    value: 2147483647,
  });
  expect(parseGitDecimal('-4294967292suffix', parser, undefined, 64)).toEqual({
    valid: true,
    value: 4,
  });
  expect(parseGitDecimal('garbage', parser)).toEqual({ valid: true, value: 0 });
  expect(parseGitDecimal(Number.NaN, parser)).toEqual({ valid: true, value: 0 });
  expect(parseGitDecimal(9007199254740992, parser)).toEqual({ valid: true, value: 0 });
  expect(parseGitDecimal('4\0suffix', parser)).toEqual({ valid: false });
  expect(parseGitDecimal(9007199254740992, { ...parser, conversion: 'atoi' })).toEqual({
    valid: false,
  });
});
