import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GitIntegerProfile } from '../constraints/git-integer.js';
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
  let longBits: 32 | 64;
  let sizeTBits: 32 | 64;
  let binaryIntegers: boolean;
  let integerProfile: GitIntegerProfile;
  let negativeMagnitudes: boolean;
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
    const widths = spawnSync('git', ['version', '--build-options'], { env, encoding: 'utf8' });
    expect(widths.error).toBeUndefined();
    expect(widths.signal).toBeNull();
    expect(widths.status).toBe(0);
    const long = /^sizeof-long: ([48])\r?$/m.exec(widths.stdout)?.[1];
    const size = /^sizeof-size_t: ([48])\r?$/m.exec(widths.stdout)?.[1];
    expect(long).toBeDefined();
    expect(size).toBeDefined();
    longBits = long === '4' ? 32 : 64;
    sizeTBits = size === '4' ? 32 : 64;
    const binary = spawnSync('git', ['clone', '--filter=blob:limit=0b1', '-h'], {
      env,
      encoding: 'utf8',
    });
    expect(binary.error).toBeUndefined();
    expect(binary.signal).toBeNull();
    binaryIntegers =
      (binary.status === 0 || binary.status === 129) &&
      (binary.stdout + binary.stderr).includes('usage:');
    if (!(legacy || binaryIntegers)) {
      expect(binary.status).toBe(128);
      expect(binary.stderr).toContain('invalid filter-spec');
    }
    // Observe the selected executable: older int callbacks cast decimal long values,
    // while unsigned-long magnitude callbacks have a separate sign policy.
    const integer = spawnSync('git', ['column', '--width=2147483648', '-h'], {
      env,
      encoding: 'utf8',
      timeout: 5000,
    });
    expect(integer.error).toBeUndefined();
    expect(integer.signal).toBeNull();
    expect([0, 129]).toContain(integer.status);
    integerProfile = integerError.test(integer.stderr) ? 'bounded' : 'decimal-cast';
    if (integerProfile === 'decimal-cast') {
      expect(integer.stdout + integer.stderr).toContain('usage:');
    }
    const magnitude = spawnSync('git', ['clone', '--filter=blob:limit=-0', '-h'], {
      env,
      encoding: 'utf8',
      timeout: 5000,
    });
    expect(magnitude.error).toBeUndefined();
    expect(magnitude.signal).toBeNull();
    negativeMagnitudes =
      (magnitude.status === 0 || magnitude.status === 129) &&
      (magnitude.stdout + magnitude.stderr).includes('usage:');
    if (!negativeMagnitudes) {
      expect(magnitude.status).toBe(128);
      expect(magnitude.stderr).toContain('invalid filter-spec');
    }
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.skipIf(legacy)(
    'matches native width, radix, sign, unit and whitespace boundaries',
    () => {
      const profiles = [
        { command: 'column', flag: '--width', signed: true, bits: 32, nativeWidth: undefined },
        { command: 'column', flag: '--raw-mode', signed: false, bits: 32, nativeWidth: undefined },
        {
          command: 'pack-objects',
          flag: '--max-pack-size',
          signed: false,
          bits: longBits,
          nativeWidth: 'long',
        },
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
        const parser = {
          kind: 'integer',
          signed: profile.signed,
          bits: profile.bits,
          nativeWidth: profile.nativeWidth,
        } as const;
        const acceptsNegativeMagnitude = profile.nativeWidth === 'long' && negativeMagnitudes;
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
          expect([0, 129], native.stderr).toContain(native.status);
          const accepted = !integerError.test(native.stderr);
          if (accepted) {
            expect(native.stdout + native.stderr).toContain('usage:');
          }
          expect(
            parseGitScalar(
              parser,
              value,
              undefined,
              longBits,
              sizeTBits,
              binaryIntegers,
              integerProfile,
              acceptsNegativeMagnitude,
            ).valid,
            `${profile.command} ${JSON.stringify(value)}: ${native.stderr}`,
          ).toBe(accepted);
          const build = () =>
            commandArguments(profile.command, [[profile.flag, value], ['-h']], true, {
              longBits,
              sizeTBits,
              binaryIntegers,
              integerProfile,
              negativeMagnitudes: acceptsNegativeMagnitude,
            });
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

  it('matches native bare-unit magnitudes under the selected sign policy', () => {
    const cases = [
      ['clone', '--filter', 'blob:limit=k'],
      ['clone', '--filter', 'tree:G'],
      ['clone', '--filter', 'combine:blob:limit=m'],
      ['clone', '--filter', 'blob:limit= k'],
      ['clone', '--filter', 'blob:limit=-k'],
      ['clone', '--filter', 'blob:limit=kk'],
      ['pack-objects', '--max-pack-size', 'g'],
      ['pack-objects', '--max-pack-size', 'K'],
      ['pack-objects', '--max-pack-size', '+k'],
    ] as const;
    for (const [command, flag, value] of cases) {
      const native = spawnSync('git', ['-C', root, command, `${flag}=${value}`, '-h'], {
        env,
        encoding: 'utf8',
        timeout: 5000,
      });
      expect(native.error, `${command} ${value}`).toBeUndefined();
      const accepted =
        [0, 129].includes(native.status ?? -1) &&
        (native.stdout + native.stderr).includes('usage:') &&
        !integerError.test(native.stderr) &&
        !native.stderr.includes('invalid filter-spec');
      const build = () =>
        commandArguments(command, [[flag, value], ['-h']], true, {
          longBits,
          sizeTBits,
          binaryIntegers,
          integerProfile,
          negativeMagnitudes,
        });
      if (accepted) {
        expect(build, `${command} ${value}: ${native.stderr}`).not.toThrow();
      } else {
        expect(build, `${command} ${value}: ${native.stderr}`).toThrow(GitArgumentError);
      }
    }
  });

  it('validates every numeric grammar and only executes callbacks reached before help', () => {
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
        const firstPass = spec.parserExit?.firstPassOptions;
        const deferred =
          firstPass &&
          (!firstPass.includes(flag) ||
            spec.parserExit?.wrappers?.some((wrapper) => !wrapper.stopAtUnknown));
        for (const value of ['', 'invalid', '18446744073709551616', Number.MAX_SAFE_INTEGER + 1]) {
          if (option.parser.numberRepresentation === 'argv' && typeof value === 'number') {
            // These callbacks parse the emitted decimal text, including values beyond 2^53.
            expect(parseGitScalar(option.parser, value, undefined, 64).valid).toBe(true);
            expect(() =>
              commandArguments(command, [[flag, value]], true, { longBits: 64, sizeTBits: 64 }),
            ).not.toThrow();
            continue;
          }
          expect(parseGitScalar(option.parser, value).valid, `${command} ${flag}`).toBe(false);
          const build = (): string[] =>
            commandArguments(command, [[flag, value], [flag, 1], ['-h']], true);
          const bareOptional =
            firstPass?.includes(flag) &&
            option.value === 'optional-integer' &&
            value === '' &&
            !flag.startsWith('--') &&
            !option.emptyValueFlag;
          if (deferred || bareOptional) {
            expect(build, `${command} ${flag}`).not.toThrow();
          } else {
            expect(build, `${command} ${flag}`).toThrow('invalid integer');
          }
        }
      }
    }
    expect(count).toBeGreaterThan(80);
  });

  it('keeps an empty optional short integer as a native bare flag', () => {
    for (const tail of [[], ['-h']]) {
      const args = [['-n', ''], ['-n', 1], ...tail.map((flag) => [flag])];
      const argv = commandArguments('tag', args, true);
      expect(argv).toEqual(['tag', '-n', '-n1', ...tail]);
      const native = spawnSync('git', argv, { cwd: root, env, encoding: 'utf8', timeout: 10000 });
      expect(native.error).toBeUndefined();
      expect(native.signal).toBeNull();
      expect(native.stderr).toBe('');
      expect(tail.length > 0 ? [0, 129] : [0]).toContain(native.status);
      if (tail.length > 0) {
        expect(native.stdout).toContain('usage:');
      }
    }
  });

  it('rejects an earlier invalid numeric value when unconditional parsing completes', () => {
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
        for (const value of ['', 'invalid', '18446744073709551616', Number.MAX_SAFE_INTEGER + 1]) {
          if (option.parser.numberRepresentation === 'argv' && typeof value === 'number') {
            // These callbacks parse the emitted decimal text, including values beyond 2^53.
            expect(parseGitScalar(option.parser, value, undefined, 64).valid).toBe(true);
            expect(() =>
              commandArguments(command, [[flag, value]], true, { longBits: 64, sizeTBits: 64 }),
            ).not.toThrow();
            continue;
          }
          const build = (): string[] =>
            commandArguments(
              command,
              [
                [flag, value],
                [flag, 1],
              ],
              true,
            );
          const bareOptional =
            spec.parserExit?.firstPassOptions?.includes(flag) &&
            option.value === 'optional-integer' &&
            value === '' &&
            !flag.startsWith('--') &&
            !option.emptyValueFlag;
          if (bareOptional) {
            // An omitted optional short value selects the native default, not an empty integer.
            expect(build, `${command} ${flag}`).not.toThrow();
          } else if (spec.conditionalCommand) {
            // A missing ref returns before the child reaches this callback.
            expect(build, `${command} ${flag}`).not.toThrow();
          } else {
            expect(build, `${command} ${flag}`).toThrow('invalid integer');
          }
        }
      }
    }
  });

  it.skipIf(legacy)('checks callback reachability against independent native help paths', () => {
    for (const [command, flag, reached] of [
      ['log', '--inter-hunk-context', false],
      ['reflog show', '--inter-hunk-context', false],
      ['stash list', '--inter-hunk-context', false],
      ['cherry-pick', '--mainline', true],
      ['format-patch', '--start-number', true],
    ] as const) {
      const native = spawnSync(
        'git',
        ['-C', root, ...command.split(' '), `${flag}=invalid`, '-h'],
        { env, encoding: 'utf8', timeout: 5000 },
      );
      expect(native.error).toBeUndefined();
      expect(native.signal).toBe(null);
      if (reached) {
        expect(native.status).toBe(129);
      } else {
        const help = spawnSync('git', ['-C', root, ...command.split(' '), '-h'], {
          env,
          encoding: 'utf8',
          timeout: 5000,
        });
        expect(help.error).toBeUndefined();
        expect(help.signal).toBe(null);
        expect([0, 129]).toContain(help.status);
        expect(help.stdout + help.stderr).toContain('usage:');
        expect(native.status).toBe(help.status);
      }
      expect(native.stderr.startsWith('error:'), `${command}: ${native.stderr}`).toBe(reached);
      const build = (): string[] => commandArguments(command, [[flag, 'invalid'], ['-h']], true);
      if (reached) {
        expect(build).toThrow(GitArgumentError);
      } else {
        expect(native.stdout).toContain('usage:');
        expect(build).not.toThrow();
      }
    }
  });

  it('preserves spellings and normalizes values for final constraints', () => {
    expect(
      commandArguments('pack-objects', [['--max-pack-size', 18446744073709551615n], ['-h']], true, {
        longBits: 64,
        sizeTBits: 64,
      }),
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
