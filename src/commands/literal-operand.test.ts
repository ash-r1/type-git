import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import { revisionParserPass } from './revision-parser-pass.js';
import type { GitCommandName } from './types.js';

const refusal = 'Use an explicit ["--"] separator before an operand starting with a dash';
const build = (command: GitCommandName, args: readonly unknown[]) =>
  commandArguments(command, args, true);

describe('operand objects never become live options', () => {
  it('refuses dash operands that a first-pass parser would consume as options', () => {
    const cases: [GitCommandName, readonly unknown[]][] = [
      ['fetch', [{ operand: '--upload-pack=touch pwned; git-upload-pack' }]],
      ['fetch', [{ operand: 'origin' }, { operand: '--upload-pack=x' }]],
      ['clone', [{ operand: '--upload-pack=x' }, { operand: 'a' }, { operand: 'b' }]],
      ['push', [{ operand: '--receive-pack=x' }, { operand: 'origin' }]],
      ['reset', [{ operand: '--hard' }]],
      ['add', [{ operand: '-A' }]],
      ['commit', [{ operand: '-a' }]],
      ['log', [{ operand: '--output=x' }]],
      ['log', [{ operand: '-p' }]],
      ['stash list', [{ operand: '--output=x' }]],
      ['stash', [{ operand: 'list' }, { operand: '--output=x' }]],
    ];
    for (const [command, args] of cases) {
      expect(() => build(command, args), `${command} ${JSON.stringify(args)}`).toThrow(refusal);
    }
  });
  it('refuses operand objects that would act as boundary markers', () => {
    expect(() => build('reset', [{ operand: '--' }])).toThrow(refusal);
    expect(() => build('fetch', [{ operand: '--' }])).toThrow(refusal);
    expect(() =>
      build('reset', [{ operand: 'HEAD' }, { operand: '--' }, { operand: 'f' }]),
    ).toThrow(refusal);
    expect(() => build('log', [{ operand: '--end-of-options' }, { operand: 'HEAD' }])).toThrow(
      refusal,
    );
  });
  it('refuses dash operands after a separator that the first pass drops before revisions', () => {
    for (const command of ['cherry-pick', 'revert'] as const) {
      expect(() => build(command, [['--'], { operand: '--no-walk' }, { operand: 'HEAD' }])).toThrow(
        refusal,
      );
      expect(() => build(command, [{ operand: '--no-walk' }, { operand: 'HEAD' }])).toThrow(
        refusal,
      );
    }
    expect(() => build('stash list', [['--'], { operand: '--output=x' }])).toThrow(refusal);
  });
  it('keeps dash operands literal after a separator that Git honors', () => {
    expect(build('fetch', [['--'], { operand: '--upload-pack=x' }])).toEqual([
      'fetch',
      '--',
      '--upload-pack=x',
    ]);
    expect(build('reset', [['--'], { operand: '--hard' }])).toEqual(['reset', '--', '--hard']);
    expect(build('add', [['--'], { operand: '-A' }])).toEqual(['add', '--', '-A']);
    expect(build('log', [['--'], { operand: '-p' }])).toEqual(['log', '--', '-p']);
    expect(build('cherry-pick', [['--no-commit'], { operand: '-' }])).toEqual([
      'cherry-pick',
      '--no-commit',
      '-',
    ]);
  });
  it('keeps option tuples and pre-exit operand words accepted', () => {
    expect(build('fetch', [['--upload-pack', 'git-upload-pack'], { operand: 'origin' }])).toEqual([
      'fetch',
      '--upload-pack=git-upload-pack',
      'origin',
    ]);
    expect(build('fetch', [{ operand: '-h' }])).toEqual(['fetch', '-h']);
    expect(build('add', [{ operand: '--dry-r' }, ['-h']])).toEqual(['add', '--dry-r', '-h']);
    // A literal word consumed as a retained option's value is not read as an option.
    expect(build('log', [['-n', '--decorate'], { operand: '-1' }])).toEqual([
      'log',
      '-n',
      '--decorate',
      '-1',
    ]);
    // Words forwarded by a mandatory subcommand dispatcher keep their native meaning.
    expect(build('refs', [{ operand: 'verify' }, ['--']])).toEqual(['refs', 'verify', '--']);
    expect(() => build('refs', [{ operand: 'verify' }, { operand: '--end-of-options' }])).toThrow(
      refusal,
    );
  });
  it('reports literal provenance from each native pass', () => {
    expect(
      initialParserPass(COMMAND_SPECS.log, ['-q', '--', '-p'], true, undefined, undefined, [
        false,
        false,
        true,
      ]),
    ).toEqual({
      exited: false,
      tokens: [['-q']],
      remaining: ['--', '-p'],
      remainingLiteral: [false, true],
    });
    expect(
      initialParserPass(COMMAND_SPECS.log, ['-q', '-h'], true, undefined, undefined, [true, false])
        .exited,
    ).toBe(true);
    expect(
      revisionParserPass(COMMAND_SPECS['cherry-pick'], ['--no-walk', 'HEAD'], [true, false])
        .literalOption,
    ).toBe(true);
    expect(
      revisionParserPass(COMMAND_SPECS['cherry-pick'], ['--no-walk', 'HEAD'], [false, false])
        .literalOption,
    ).toBeUndefined();
  });
  it('refuses the injection before any process is spawned', async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-literal-operand-'));
    try {
      const git = new TypeGit();
      const repo = await git.init(join(root, 'repo'));
      const marker = join(root, 'pwned');
      await expect(
        repo.command('fetch', [
          { operand: join(root, 'missing') },
          { operand: `--upload-pack=touch ${marker}; git-upload-pack` },
        ]),
      ).rejects.toThrow(GitArgumentError);
      expect(existsSync(marker)).toBe(false);
      await expect(repo.command('reset', [{ operand: '--hard' }])).rejects.toThrow(refusal);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
