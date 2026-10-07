import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseGitInteger } from '../constraints/git-integer.js';
import { parseGitScalar } from '../constraints/git-scalars.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import type { CommandSpec } from './spec.js';
import type { GitCommandName } from './types.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';
const integerError = /expects (?:a numerical|an integer|a non-negative integer) value|not in range/;

describe('compiler-recorded native integer parsers', () => {
  let root: string;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-integer-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'config'),
      LC_ALL: 'C',
    };
    expect(spawnSync('git', ['init', root], { env }).status).toBe(0);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.skipIf(legacy)(
    'matches native width, radix, sign, unit and whitespace boundaries',
    () => {
      const profiles = [
        { command: 'column', flag: '--width', signed: true, bits: 32 },
        { command: 'column', flag: '--raw-mode', signed: false, bits: 32 },
        { command: 'pack-objects', flag: '--max-pack-size', signed: false, bits: 64 },
      ] as const;
      const lexical = [
        '',
        ' ',
        '+',
        '-',
        '0',
        '-0',
        '+0',
        '00',
        '08',
        '0x',
        '0b',
        '0Xf',
        '0B11',
        '  +010k',
        '\t1M',
        '1g',
        '-2G',
        '1 ',
        '1.0',
        '1e3',
        '1kb',
        '1K',
        '0x1g',
        '0b11k',
        '1\n',
        '\u00a01',
      ];
      for (const profile of profiles) {
        const parser = { kind: 'integer', signed: profile.signed, bits: profile.bits } as const;
        const limit = 1n << BigInt(profile.bits - (profile.signed ? 1 : 0));
        const values = [...lexical];
        for (const boundary of [0n, limit, -limit]) {
          for (let offset = -2n; offset <= 2n; offset++) {
            const value = boundary + offset;
            const sign = value < 0n ? '-' : '';
            const magnitude = value < 0n ? -value : value;
            values.push(
              String(value),
              `${sign}0x${magnitude.toString(16)}`,
              `${sign}0${magnitude.toString(8)}`,
              `${sign}0b${magnitude.toString(2)}`,
            );
          }
        }
        for (const [unit, power] of [
          ['k', 10n],
          ['m', 20n],
          ['g', 30n],
        ] as const) {
          for (const value of [(limit >> power) - 1n, limit >> power, (limit >> power) + 1n]) {
            values.push(`${value}${unit}`, `-${value}${unit}`);
          }
        }
        for (const value of new Set(values)) {
          const native = spawnSync(
            'git',
            ['-C', root, ...profile.command.split(' '), `${profile.flag}=${value}`, '-h'],
            { env, encoding: 'utf8', timeout: 5000 },
          );
          expect(native.error, `${profile.command} ${value}`).toBeUndefined();
          expect(native.status, native.stderr).toBe(129);
          const accepted = !integerError.test(native.stderr);
          if (accepted) {
            expect(native.stdout + native.stderr).toContain('usage:');
          }
          expect(
            parseGitInteger(value, parser) !== undefined,
            `${profile.command} ${JSON.stringify(value)}: ${native.stderr}`,
          ).toBe(accepted);
          const build = () =>
            commandArguments(profile.command, [[profile.flag, value], ['-h']], true);
          if (accepted) {
            expect(build).not.toThrow();
          } else {
            expect(build).toThrow(GitArgumentError);
          }
        }
      }
    },
    30000,
  );

  it('validates each numeric schema before a later overwrite or help', () => {
    let count = 0;
    for (const [command, spec] of Object.entries(COMMAND_SPECS) as [
      GitCommandName,
      CommandSpec,
    ][]) {
      for (const [flag, option] of Object.entries(spec.options)) {
        if (
          typeof option.parser !== 'object' ||
          option.parser.kind !== 'integer' ||
          option.value === 'flag'
        ) {
          continue;
        }
        count++;
        for (const value of ['', 'invalid', '18446744073709551616', Number.MAX_SAFE_INTEGER + 1]) {
          expect(
            () => commandArguments(command, [[flag, value], [flag, 1], ['-h']], true),
            `${command} ${flag}`,
          ).toThrow('invalid integer');
        }
      }
    }
    expect(count).toBeGreaterThan(80);
  });

  it('preserves spellings and normalizes values for final constraints', () => {
    expect(
      commandArguments('pack-objects', [['--max-pack-size', 18446744073709551615n], ['-h']], true),
    ).toContain('--max-pack-size=18446744073709551615');
    expect(commandArguments('column', [['--width', '  +010k'], ['-h']])).toContain(
      '--width=  +010k',
    );
    expect(
      commandArguments('pack-objects', [['--max-pack-size', '0x0'], ['--stdout']], true),
    ).toContain('--max-pack-size=0x0');
    expect(() =>
      commandArguments('pack-objects', [['--max-pack-size', '0x1'], ['--stdout']], true),
    ).toThrow(GitArgumentError);
    expect(() =>
      commandArguments(
        'pack-objects',
        [['--max-pack-size', '18446744073709551615'], ['--stdout']],
        true,
      ),
    ).toThrow(GitArgumentError);
    expect(() =>
      commandArguments(
        'pack-objects',
        [['--max-pack-size', 1], ['--no-max-pack-size'], ['--stdout']],
        true,
      ),
    ).not.toThrow();
    expect(parseGitScalar({ kind: 'integer', signed: false, bits: 64 }, 0n).value).toBe(0);
    expect(
      parseGitScalar({ kind: 'integer', signed: false, bits: 64 }, '18446744073709551615').value,
    ).toBe(18446744073709551615n);
  });

  it('records optional defaults and zeroing negations', () => {
    for (const [command, flag, value] of [
      ['fmt-merge-msg', '--log', 20],
      ['fmt-merge-msg', '--summary', 20],
      ['merge', '--log', 20],
      ['show-branch', '--more', 1],
      ['tag', '-n', 1],
    ] as const) {
      const spec: CommandSpec = COMMAND_SPECS[command];
      expect(spec.options[flag]?.set).toBe(value);
      expect(spec.options[flag]?.parser).toEqual({ kind: 'integer', signed: true, bits: 32 });
    }
    const snapshot = JSON.parse(
      readFileSync(
        new URL('../../spec/upstream/git-numeric-options.json', import.meta.url),
        'utf8',
      ),
    );
    expect(snapshot.options).toHaveLength(67);
    expect(snapshot.options.filter((row: { bits: number }) => row.bits === 64)).toHaveLength(8);
    for (const spec of Object.values(COMMAND_SPECS) as CommandSpec[]) {
      for (const [flag, option] of Object.entries(spec.options)) {
        if (
          flag.startsWith('--no-') &&
          typeof option.parser === 'object' &&
          option.parser.kind === 'integer'
        ) {
          expect(option.set).toBe(0);
          expect(option.clear).toBeUndefined();
        }
      }
    }
  });
});
