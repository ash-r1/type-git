import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';
describe('submodule frontends, helpers and sparse checkout grammars', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  const direct = (args: string[], input = '') =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input,
      encoding: 'utf8',
      timeout: 10000,
    });
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-submodule-sparse-'));
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
      GIT_ALLOW_PROTOCOL: 'file',
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await writeFile(join(repo.workdir, 'second'), 'two\n');
    await repo.add('.');
    await repo.commit({ message: 'initial' });
    await writeFile(join(repo.workdir, 'tracked'), 'changed\n');
    await repo.add('.');
    await repo.commit({ message: 'second' });
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const compare = (
    command: GitCommandName,
    args: readonly unknown[],
    argv: string[],
    valid: boolean,
    input = '',
  ) => {
    const actual = direct([...command.split(' '), ...argv], input);
    const label = `${command} ${argv.join(' ')}: ${actual.stderr}`;
    expect(actual.signal, label).toBe(null);
    expect(actual.error, label).toBeUndefined();
    expect(actual.status === 0, label).toBe(valid);
    const build = () => commandArguments(command, args, true);
    if (valid) {
      expect(build()).toEqual([...command.split(' '), ...argv]);
    } else {
      expect(build, label).toThrow(GitArgumentError);
    }
  };

  it('accepts empty-submodule operations and native root dispatch', () => {
    compare('submodule', [], [], true);
    compare('submodule', [['--cached']], ['--cached'], true);
    for (const commandRoot of legacy ? ['submodule'] : ['submodule', 'submodule--helper']) {
      for (const op of [
        'init',
        'status',
        'sync',
        'summary',
        'foreach',
        'absorbgitdirs',
        'update',
      ]) {
        compare(`${commandRoot} ${op}` as GitCommandName, [], [], true);
      }
    }
    compare('submodule', [['--cached'], { operand: 'update' }], ['--cached', 'update'], false);
    compare('submodule', [{ operand: 'unknown' }], ['unknown'], false);
    compare('submodule--helper', [], [], false);
    compare('submodule--helper', [{ operand: 'unknown' }], ['unknown'], false);
    compare('sparse-checkout', [], [], false);
  });
  it('matches arities and tracking/deinit choices before repository effects', () => {
    for (const commandRoot of legacy ? ['submodule'] : ['submodule', 'submodule--helper']) {
      compare(`${commandRoot} deinit` as GitCommandName, [], [], false);
      compare(`${commandRoot} deinit` as GitCommandName, [['--all']], ['--all'], true);
      compare(
        `${commandRoot} deinit` as GitCommandName,
        [['--all'], { operand: 'missing' }],
        ['--all', 'missing'],
        false,
      );
      compare(`${commandRoot} add` as GitCommandName, [], [], false);
      compare(
        `${commandRoot} set-url` as GitCommandName,
        [{ operand: 'missing' }],
        ['missing'],
        false,
      );
      compare(
        `${commandRoot} set-branch` as GitCommandName,
        [{ operand: 'missing' }],
        ['missing'],
        false,
      );
      compare(
        `${commandRoot} set-branch` as GitCommandName,
        [['--branch', ''], ['--default'], { operand: 'missing' }],
        ['--branch=', '--default', 'missing'],
        false,
      );
    }
    if (!legacy) {
      compare('submodule--helper clone', [], [], false);
      compare(
        'submodule--helper clone',
        [
          ['--url', '.'],
          ['--path', ''],
        ],
        ['--url=.', '--path='],
        false,
      );
      compare('submodule--helper create-branch', [], [], false);
      compare('submodule--helper get-default-remote', [], [], false);
      compare('submodule--helper gitdir', [], [], false);
      compare('submodule--helper push-check', [], [], false);
    }
  });
  it.skipIf(legacy)(
    'matches filter prerequisites, frontend spellings and fixed strategy forwarding',
    () => {
      for (const commandRoot of legacy ? ['submodule'] : ['submodule', 'submodule--helper']) {
        compare(
          `${commandRoot} update` as GitCommandName,
          [['--filter', 'blob:none']],
          ['--filter=blob:none'],
          false,
        );
        compare(
          `${commandRoot} update` as GitCommandName,
          [['--filter', 'blob:none'], ['--init']],
          ['--filter=blob:none', '--init'],
          true,
        );
        compare(
          `${commandRoot} update` as GitCommandName,
          [['--filter', 'blob:none'], ['--require-init']],
          ['--filter=blob:none', '--require-init'],
          true,
        );
        compare(
          `${commandRoot} update` as GitCommandName,
          [['--checkout'], ['--merge'], ['--rebase']],
          ['--checkout', '--merge', '--rebase'],
          true,
        );
        compare(
          `${commandRoot} update` as GitCommandName,
          [['--ref-format', 'unknown']],
          ['--ref-format=unknown'],
          false,
        );
        compare(
          `${commandRoot} update` as GitCommandName,
          [
            ['--ref-format', 'unknown'],
            ['--ref-format', 'files'],
          ],
          ['--ref-format=unknown', '--ref-format=files'],
          true,
        );
      }
      compare(
        'submodule--helper update',
        [['--require-init'], ['--no-init'], ['--filter', 'blob:none']],
        ['--require-init', '--no-init', '--filter=blob:none'],
        true,
      );
      compare('submodule update', [['--no-init']], ['--no-init'], false);
      compare(
        'submodule update',
        [['--init'], ['--quiet'], ['--verbose']],
        ['--init', '--quiet', '--verbose'],
        true,
      );
      compare('submodule update', [['-i']], ['-i'], false);
      compare('submodule update', [['-i'], ['--init']], ['-i', '--init'], true);
      compare('submodule update', [['--init'], ['-i']], ['--init', '-i'], false);
      compare('submodule foreach', [['--'], { operand: 'true' }], ['--', 'true'], false);
      compare('submodule--helper foreach', [['--'], { operand: 'true' }], ['--', 'true'], true);
    },
  );
  it('preserves summary early return and parent-level quiet options', () => {
    for (const commandRoot of legacy ? ['submodule'] : ['submodule', 'submodule--helper']) {
      compare(
        `${commandRoot} summary` as GitCommandName,
        [['--cached'], ['--files']],
        ['--cached', '--files'],
        false,
      );
      compare(
        `${commandRoot} summary` as GitCommandName,
        [['--cached'], ['--files'], ['--summary-limit', 0]],
        ['--cached', '--files', '--summary-limit=0'],
        true,
      );
    }
    const argv = commandArguments('submodule summary', [['--quiet'], ['--summary-limit', 0]], true);
    expect(argv).toEqual(['submodule', '--quiet', 'summary', '--summary-limit=0']);
    expect(direct(argv).status).toBe(0);
  });
  it.skipIf(legacy)(
    'preserves sparse-checkout ignored operands, stdin precedence and configuration',
    () => {
      compare(
        'sparse-checkout init',
        [['--cone'], { operand: 'ignored' }],
        ['--cone', 'ignored'],
        true,
      );
      compare('sparse-checkout list', [{ operand: 'ignored' }], ['ignored'], true);
      compare(
        'sparse-checkout set',
        [['--skip-checks'], ['--stdin'], { operand: 'unused' }],
        ['--skip-checks', '--stdin', 'unused'],
        true,
        'source\n',
      );
      compare(
        'sparse-checkout add',
        [['--skip-checks'], ['--stdin'], { operand: 'unused' }],
        ['--skip-checks', '--stdin', 'unused'],
        true,
        'other\n',
      );
      compare('sparse-checkout reapply', [{ operand: 'ignored' }], ['ignored'], true);
      compare(
        'sparse-checkout check-rules',
        [['--cone'], { operand: 'ignored' }],
        ['--cone', 'ignored'],
        true,
        'source/file\n',
      );
      compare(
        'sparse-checkout clean',
        [['--dry-run'], { operand: 'ignored' }],
        ['--dry-run', 'ignored'],
        true,
      );
      expect(direct(['config', 'clean.requireForce', 'false']).status).toBe(0);
      compare('sparse-checkout clean', [], [], true);
      compare('sparse-checkout disable', [{ operand: 'ignored' }], ['ignored'], true);
      compare(
        'sparse-checkout set',
        [['--no-cone'], ['--sparse-index']],
        ['--no-cone', '--sparse-index'],
        true,
      );
      compare('sparse-checkout disable', [], [], true);
    },
  );
  it('executes public submodule operations against a local fixture', async () => {
    const child = await new TypeGit({ home: root, inheritEnv: false, env }).init(
      join(root, 'child'),
    );
    await writeFile(join(child.workdir, 'content'), 'child\n');
    await child.add('.');
    await child.commit({ message: 'child' });
    compare(
      'submodule add',
      [{ operand: child.workdir }, { operand: 'module' }],
      [child.workdir, 'module'],
      true,
    );
    if (!legacy) {
      // The old shell frontend rejects an empty equals-form branch value.
      compare(
        'submodule set-branch',
        [['--branch', ''], { operand: 'module' }],
        ['--branch=', 'module'],
        true,
      );
    }
    compare(
      'submodule set-branch',
      [['-b', ''], { operand: 'module' }],
      ['-b', '', 'module'],
      false,
    );
    compare(
      'submodule set-branch',
      [['-b', 'main'], { operand: 'module' }],
      ['-b', 'main', 'module'],
      true,
    );
    compare(
      'submodule set-branch',
      [['--default'], { operand: 'module' }],
      ['--default', 'module'],
      true,
    );
    compare(
      'submodule set-url',
      [{ operand: 'module' }, { operand: child.workdir }],
      ['module', child.workdir],
      true,
    );
    compare('submodule foreach', [{ operand: 'true' }], ['true'], true);
    if (!legacy) {
      compare('submodule--helper gitdir', [{ operand: 'module' }], ['module'], true);
      compare('submodule--helper get-default-remote', [{ operand: 'module' }], ['module'], true);
      const oid = direct(['rev-parse', 'HEAD']).stdout.trim();
      compare(
        'submodule--helper create-branch',
        [['--dry-run'], { operand: 'preview' }, { operand: oid }, { operand: 'HEAD' }],
        ['--dry-run', 'preview', oid, 'HEAD'],
        true,
      );
      expect(direct(['remote', 'add', 'origin', child.workdir]).status).toBe(0);
      compare(
        'submodule--helper push-check',
        [{ operand: 'HEAD' }, { operand: 'origin' }],
        ['HEAD', 'origin'],
        true,
      );
      compare(
        'submodule--helper migrate-gitdir-configs',
        [{ operand: 'ignored' }],
        ['ignored'],
        true,
      );
    }
  });
});
