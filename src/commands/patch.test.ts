import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';
const patch =
  'diff --git a/tracked b/tracked\n--- a/tracked\n+++ b/tracked\n@@ -1 +1 @@\n-one\n+two\n';

describe('patch application parser grammars', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-patch-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'global'),
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      GIT_EDITOR: 'true',
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await repo.add('tracked');
    await repo.commit({ message: 'initial' });
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const direct = (args: string[], input = '') =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input,
      encoding: 'utf8',
      timeout: 10000,
    });

  it('exhaustively compares short apply flag sequences with independent Git', () => {
    const flagDomain = [
      '--3way',
      '--no-3way',
      '--reject',
      '--no-reject',
      ...(legacy ? [] : ['--ours', '--theirs', '--union']),
    ];
    const cases: string[][] = [[]];
    for (let length = 1; length <= 3; length++) {
      for (const prefix of cases.filter((c) => c.length === length - 1)) {
        for (const flag of flagDomain) {
          cases.push([...prefix, flag]);
        }
      }
    }
    for (const flags of cases) {
      const actual = direct(['apply', ...flags, '--stat'], patch);
      expect(actual.signal).toBe(null);
      const build = () => commandArguments('apply', [...flags.map((f) => [f]), ['--stat']], true);
      if (actual.status === 0) {
        expect(build()).toEqual(['apply', ...flags, '--stat']);
      } else {
        expect(build, `${flags.join(' ')}: ${actual.stderr}`).toThrow(GitArgumentError);
      }
    }
  });

  it('checks callback values before later tokens can replace them', () => {
    for (const value of [
      'warn',
      'nowarn',
      'error',
      'error-all',
      'strip',
      'fix',
      'WARN',
      'invalid',
      '',
    ]) {
      const actual = direct(
        ['apply', `--whitespace=${value}`, '--whitespace=warn', '--stat'],
        patch,
      );
      const build = () =>
        commandArguments('apply', [['--whitespace', value], ['--whitespace', 'warn'], ['--stat']]);
      if (actual.status === 0) {
        expect(build()).toEqual(['apply', `--whitespace=${value}`, '--whitespace=warn', '--stat']);
      } else {
        expect(build).toThrow(GitArgumentError);
      }
    }
    for (const value of [-1, 0, 1, 2147483647, 2147483648]) {
      const actual = direct(['apply', '-p', String(value), '-p1', '--stat'], patch);
      const build = () => commandArguments('apply', [['-p', value], ['-p', 1], ['--stat']]);
      if (legacy && (value < 0 || value > 2147483647)) {
        expect(actual.status, actual.stderr).toBe(0); // Git 2.25 used atoi without this validation.
        expect(build).toThrow(GitArgumentError);
      } else if (actual.status === 0) {
        expect(build()).toEqual(['apply', '-p', String(value), '-p', '1', '--stat']);
      } else {
        expect(build).toThrow(GitArgumentError);
      }
    }
    // These native 2.55 callbacks assert on negation (SIGABRT); do not crash the test runner's child processes.
    for (const flag of ['--no-whitespace', '--no-directory']) {
      expect(() => commandArguments('apply', [[flag]])).toThrow(GitArgumentError);
    }
    expect(() => commandArguments('apply', [['--index']], false)).toThrow(GitArgumentError);
    expect(commandArguments('apply', [['--cached'], ['--intent-to-add']], true)).toEqual([
      'apply',
      '--cached',
      '--intent-to-add',
    ]);
  });

  it('compares native mode identities and immediate enum errors in am', () => {
    const cases = [
      ['--continue', '--resolved', '-r'],
      ['--continue', '--skip', '--continue'],
      ['--show-current-patch', '--show-current-patch=raw'],
      ['--show-current-patch=raw', '--show-current-patch=diff'],
      ['--show-current-patch=diff', '--show-current-patch=diff'],
      ['--show-current-patch=raw', '--continue'],
      ['--continue', '--patch-format=mbox', '--no-patch-format'],
      ['--continue', '--patch-format=invalid', '--patch-format=mbox'],
      ...(legacy
        ? []
        : [
            ['--continue', '--empty=KEEP', '--empty=keep'],
            ['--continue', '--quoted-cr=warn'],
            ['--continue', '--quoted-cr=bad'],
          ]),
    ];
    for (const flags of cases) {
      if (legacy && flags.some((flag) => flag.startsWith('--show-current-patch='))) {
        expect(direct(['am', ...flags]).stderr).toContain('takes no value');
        continue;
      }
      const actual = direct(['am', ...flags]);
      const args = flags.map((f) => (f.includes('=') ? f.split('=') : [f]));
      // Valid modes reach the session check; invalid options fail during parsing.
      if (actual.stderr.includes('not in progress')) {
        expect(commandArguments('am', args)).toEqual(['am', ...flags]);
      } else {
        expect(() => commandArguments('am', args), actual.stderr).toThrow(GitArgumentError);
      }
    }
  });

  it.skipIf(legacy)('verifies every generated am mode transition against Git', async () => {
    type Token = { flag: string; value?: string; mode: string | false };
    type Machine = {
      tokens: Token[];
      transitions: { from: string | null; acceptedTokens: number[] }[];
    };
    const report: { commands: { command: string; modes?: Machine[] }[] } = JSON.parse(
      await readFile(
        new URL('../../docs/design/command-exploration.json', import.meta.url),
        'utf8',
      ),
    );
    const machine = report.commands.find((c) => c.command === 'am')?.modes?.[0];
    expect(machine).toBeDefined();
    if (!machine) {
      throw new Error('Missing am transition machine');
    }
    const argv = (t: Token) => (t.value === undefined ? t.flag : `${t.flag}=${t.value}`);
    const tuple = (t: Token) => (t.value === undefined ? [t.flag] : [t.flag, t.value]);
    for (const row of machine.transitions) {
      const previous =
        row.from === null ? undefined : machine.tokens.find((t) => t.mode === row.from);
      for (const [index, incoming] of machine.tokens.entries()) {
        const tokens = [...(previous ? [previous] : []), incoming];
        const actual = direct(['am', ...tokens.map(argv)]);
        const accepted = row.acceptedTokens.includes(index);
        expect(actual.stderr.includes('not in progress'), tokens.map(argv).join(' ')).toBe(
          accepted,
        );
        const build = () => commandArguments('am', tokens.map(tuple));
        if (accepted) {
          expect(build()).toEqual(['am', ...tokens.map(argv)]);
        } else {
          expect(build).toThrow(GitArgumentError);
        }
      }
    }
  });

  it('leaves delegated apply rules conditional on reaching patch application', async () => {
    const stray = join(repo.workdir, '.git', 'rebase-apply');
    await mkdir(stray);
    const actual = direct(['am', '--quit', '--whitespace=invalid', 'ignored-file']);
    expect(actual.status, actual.stderr).toBe(0);
    await mkdir(stray);
    const wrapped = await repo.command('am', [
      ['--quit'],
      ['--whitespace', 'invalid'],
      { operand: 'ignored-file' },
    ]);
    expect(wrapped.exitCode, wrapped.stderr).toBe(0);
  });

  it('applies a patch and a mail series through the public API', async () => {
    const checked = await repo.command('apply', [['--check']], { stdin: patch });
    expect(checked.exitCode, checked.stderr).toBe(0);
    const applied = await repo.command('apply', [], { stdin: patch });
    expect(applied.exitCode, applied.stderr).toBe(0);
    expect(await readFile(join(repo.workdir, 'tracked'), 'utf8')).toBe('two\n');
    await repo.add('tracked');
    await repo.commit({ message: 'patch commit' });
    const mail = direct(['format-patch', '-1', '--stdout']);
    expect(mail.status, mail.stderr).toBe(0);
    expect(direct(['reset', '--hard', 'HEAD~1']).status).toBe(0);
    const result = await repo.command('am', [['--patch-format', 'mbox']], { stdin: mail.stdout });
    expect(result.exitCode, result.stderr).toBe(0);
    expect(await readFile(join(repo.workdir, 'tracked'), 'utf8')).toBe('two\n');
  });
});
