import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import {
  validObjectFilter,
  objectFilterUsesHighBytes,
  objectFilterUnsignedChar,
} from '../constraints/object-filter.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from '../runner/cli-runner.js';
import { commandArguments } from './build.js';

const high = 'combine:sparse:oid=é';
const nativeCases = [
  high,
  'combine:sparse:oid=%c3%a9',
  'combine:combine:sparse:oid=%ff',
  'combine:sparse:oid=%00',
  'combine:sparse:oid=\x7f',
];

describe('selected C char object-filter validation', () => {
  for (const [filename, unsignedChar] of [
    ['object-filter-corpus.json', true],
    ['object-filter-signed-char-corpus.json', false],
  ] as const) {
    it(`checks all 1,331 source-profile outcomes in ${filename}`, () => {
      const corpus = JSON.parse(
        readFileSync(new URL(`../../test/fixtures/${filename}`, import.meta.url), 'utf8'),
      ) as { cases: { filter: string; valid: boolean }[] };
      expect(corpus.cases).toHaveLength(1331);
      for (const entry of corpus.cases) {
        const build = () =>
          commandArguments('cat-file', [['--filter', entry.filter], ['-h']], true, {
            longBits: 64,
            sizeTBits: 64,
            unsignedChar,
          });
        if (entry.valid) {
          expect(build, entry.filter).not.toThrow();
        } else {
          expect(build, entry.filter).toThrow(GitArgumentError);
        }
      }
    });
  }
  for (const binary of [
    'git',
    ...(process.env.TYPE_GIT_UNSIGNED_CHAR_BINARY
      ? [process.env.TYPE_GIT_UNSIGNED_CHAR_BINARY]
      : []),
  ]) {
    it(`matches the selected executable ${binary} without a transport URL`, async () => {
      const root = await mkdtemp(join(tmpdir(), 'type-git-char-profile-'));
      try {
        const env = {
          ...process.env,
          HOME: root,
          XDG_CONFIG_HOME: root,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: join(root, 'config'),
          LC_ALL: 'C',
        };
        const runner = new CliRunner(createNodeAdapters(), {
          gitBinary: binary,
          home: root,
          inheritEnv: false,
          env,
        });
        for (const filter of nativeCases) {
          const native = spawnSync(binary, ['clone', `--filter=${filter}`, '-h'], {
            env,
            encoding: 'utf8',
            timeout: 5000,
          });
          expect(native.error).toBeUndefined();
          if (native.status === 128) {
            expect(native.stderr).toContain('must escape char in sub-filter-spec');
            await expect(
              runner.runCommand({ type: 'global' }, 'clone', [['--filter', filter], ['-h']]),
            ).rejects.toBeInstanceOf(GitArgumentError);
          } else {
            expect([0, 129]).toContain(native.status);
            expect(native.stdout + native.stderr).toContain('usage:');
            const actual = await runner.runCommand({ type: 'global' }, 'clone', [
              ['--filter', filter],
              ['-h'],
            ]);
            expect(actual.exitCode).toBe(native.status);
            expect(actual.stdout).toBe(native.stdout);
            expect(actual.stderr).toBe(native.stderr);
          }
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }

  it('checks signed char only in raw combined components, after each decoding level', () => {
    expect(validObjectFilter(high, false, 64, true, false, false)).toBe(false);
    expect(validObjectFilter(high, false, 64, true, false, true)).toBe(true);
    expect(validObjectFilter('sparse:oid=é', false, 64, true, false, false)).toBe(true);
    expect(validObjectFilter('combine:sparse:oid=%c3%a9', false, 64, true, false, false)).toBe(
      true,
    );
    expect(validObjectFilter('combine:combine:sparse:oid=%ff', false, 64, true, false, false)).toBe(
      false,
    );
    expect(objectFilterUsesHighBytes('combine:combine:sparse:oid=%ff')).toBe(true);
    expect(objectFilterUsesHighBytes('combine:sparse:oid=%ff')).toBe(false);
    expect(objectFilterUsesHighBytes('sparse:oid=é')).toBe(false);
  });

  for (const unsigned of [false, true]) {
    it(`propagates C char ${unsigned ? 'unsigned' : 'signed'} to convenience validation`, async () => {
      const adapters = createNodeAdapters();
      adapters.exec.spawn = vi.fn().mockResolvedValue({
        exitCode: unsigned ? 129 : 128,
        stdout: unsigned ? 'usage: git clone\n' : '',
        stderr: unsigned ? '' : "fatal: must escape char in sub-filter-spec: 'byte'\n",
        aborted: false,
      });
      const runner = new CliRunner(adapters, { gitBinary: '/selected/git' });
      const promise = runner.validateFilterOptions(
        { type: 'worktree', workdir: '/repo' },
        'clone',
        { filter: high },
      );
      if (unsigned) {
        await expect(promise).resolves.toBeUndefined();
      } else {
        await expect(promise).rejects.toBeInstanceOf(GitArgumentError);
      }
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: ['/selected/git', '-C', '/repo', 'clone', '--filter=combine:sparse:oid=é', '-h'],
          stdin: undefined,
        }),
        undefined,
      );
    });
  }

  it('does not mistake a failed or unrecognized probe for an unsigned-char profile', () => {
    expect(
      objectFilterUnsignedChar({ exitCode: 0, stdout: 'usage: git clone', stderr: '' }),
    ).toBeUndefined();
    expect(
      objectFilterUnsignedChar({ exitCode: 128, stdout: '', stderr: 'fatal: invalid filter-spec' }),
    ).toBeUndefined();
  });

  it('preserves context and stdin when an unrecognized probe delegates to native validation', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 128,
        stdout: '',
        stderr: 'custom diagnostic',
        aborted: false,
      })
      .mockResolvedValue({
        exitCode: 128,
        stdout: '',
        stderr: 'original native diagnostic',
        aborted: false,
      });
    const signal = new AbortController().signal;
    const actual = await new CliRunner(adapters, { gitBinary: '/selected/git' }).runCommand(
      { type: 'worktree', workdir: '/selected/repo' },
      'clone',
      [['--filter', high], ['-h']],
      true,
      { signal, env: { TYPE_GIT_CHAR_FIXTURE: 'value' }, stdin: 'original-input' },
    );
    expect(actual.exitCode).toBe(128);
    expect(actual.stderr).toBe('original native diagnostic');
    expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        argv: [
          '/selected/git',
          '-C',
          '/selected/repo',
          'clone',
          '--filter=combine:sparse:oid=é',
          '-h',
        ],
        signal,
        stdin: undefined,
        env: expect.objectContaining({ TYPE_GIT_CHAR_FIXTURE: 'value' }),
      }),
      undefined,
    );
    expect(adapters.exec.spawn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ stdin: 'original-input', signal }),
      undefined,
    );
  });

  it('returns cancelled bytes without executing the original high-byte filter', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi
      .fn()
      .mockResolvedValue({ exitCode: 143, stdout: '', stderr: '', aborted: true });
    adapters.exec.spawnBytes = vi.fn();
    const actual = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'clone',
      [['--filter', high], ['-h']],
      false,
      { stdout: 'bytes', stdin: new Uint8Array([1]) },
    );
    expect(actual.aborted).toBe(true);
    expect(actual.stdout).toEqual(new Uint8Array(0));
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.exec.spawnBytes).not.toHaveBeenCalled();
  });

  it('rejects a universally reserved byte before native C char detection', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn();
    await expect(
      new CliRunner(adapters).runCommand(
        { type: 'global' },
        'clone',
        [['--filter', 'combine:sparse:oid=é\u0001'], ['-h']],
        false,
      ),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
});
