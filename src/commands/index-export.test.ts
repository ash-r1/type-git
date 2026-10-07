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
describe('index callback phases and fast export', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-index-export-'));
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
    for (let i = 0; i < 4; i++) {
      expect(direct(['commit', '--allow-empty', '-m', `step ${i}`]).status).toBe(0);
    }
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

  it('requires stdin callbacks to be last, while permitting earlier paths', () => {
    for (const flag of ['--stdin', '--index-info']) {
      compare('update-index', [[flag]], [flag], true);
      compare('update-index', [['-z'], [flag]], ['-z', flag], true);
      compare('update-index', [[flag], ['-z']], [flag, '-z'], false);
      compare('update-index', [[flag], { operand: 'tracked' }], [flag, 'tracked'], false);
      compare('update-index', [{ operand: 'tracked' }, [flag]], ['tracked', flag], true);
    }
  });
  it('preserves remainder-consuming callbacks and separate cacheinfo values', () => {
    compare(
      'update-index',
      [['--again'], { operand: '--not-an-option' }],
      ['--again', '--not-an-option'],
      true,
    );
    expect(() => commandArguments('update-index', [['--again'], ['--refresh']], true)).toThrow(
      GitArgumentError,
    );
    compare(
      'update-index',
      [['--again'], { operand: '--refresh' }],
      ['--again', '--refresh'],
      true,
    );
    const oid = direct(['rev-parse', 'HEAD:tracked']).stdout.trim();
    const value = `100644,${oid},added`;
    compare(
      'update-index',
      [['--add'], ['--cacheinfo', value]],
      ['--add', '--cacheinfo', value],
      true,
    );
    compare(
      'update-index',
      [['--add'], ['--cacheinfo', '100644'], { operand: oid }, { operand: 'legacy-added' }],
      ['--add', '--cacheinfo', '100644', oid, 'legacy-added'],
      true,
    );
    expect(direct(['reset', '--hard', 'HEAD']).status).toBe(0);
  });
  it('matches index version dispatch and immediate chmod validation', () => {
    for (const version of legacy ? [0, 1, 2, 3, 4, 5] : [-2, -1, 0, 1, 2, 3, 4, 5]) {
      compare(
        'update-index',
        [['--index-version', version]],
        [`--index-version=${version}`],
        ![1, 5].includes(version),
      );
    }
    compare(
      'update-index',
      [
        ['--index-version', 5],
        ['--index-version', 2],
      ],
      ['--index-version=5', '--index-version=2'],
      true,
    );
    compare(
      'update-index',
      [['--index-version', 5], ['--no-index-version']],
      ['--index-version=5', '--no-index-version'],
      true,
    );
    compare(
      'update-index',
      [['--chmod', 'invalid'], ['--chmod', '+x'], { operand: 'tracked' }],
      ['--chmod=invalid', '--chmod=+x', 'tracked'],
      false,
    );
    compare(
      'update-index',
      [['--chmod', '+x'], { operand: 'tracked' }, ['--chmod', '-x'], { operand: 'tracked' }],
      ['--chmod=+x', 'tracked', '--chmod=-x', 'tracked'],
      true,
    );
  });
  it('matches export input choices and final anonymization prerequisites', () => {
    compare('fast-export', [], [], false);
    compare('fast-export', [['--no-data']], ['--no-data'], true);
    compare('fast-export', [{ operand: 'HEAD' }], ['HEAD'], true);
    compare(
      'fast-export',
      [
        ['--import-marks', ''],
        ['--import-marks-if-exists', ''],
      ],
      ['--import-marks=', '--import-marks-if-exists='],
      false,
    );
    if (!legacy) {
      compare('fast-export', [['--anonymize-map', 'name']], ['--anonymize-map=name'], false);
      compare(
        'fast-export',
        [['--anonymize-map', 'name'], ['--anonymize']],
        ['--anonymize-map=name', '--anonymize'],
        true,
      );
      compare(
        'fast-export',
        [['--anonymize'], ['--anonymize-map', 'from:to'], ['--no-anonymize']],
        ['--anonymize', '--anonymize-map=from:to', '--no-anonymize'],
        false,
      );
      for (const value of ['', ':to', 'from:']) {
        compare(
          'fast-export',
          [['--anonymize'], ['--anonymize-map', value], ['--anonymize-map', 'valid']],
          ['--anonymize', `--anonymize-map=${value}`, '--anonymize-map=valid'],
          false,
        );
      }
      compare(
        'fast-export',
        [['--anonymize'], ['--anonymize-map', 'from:to:more'], { operand: 'HEAD' }],
        ['--anonymize', '--anonymize-map=from:to:more', 'HEAD'],
        true,
      );
    }
  });
  it('validates export callback modes immediately and respects native case rules', () => {
    for (const mode of ['abort', 'verbatim', 'warn', 'warn-strip', 'strip']) {
      compare(
        'fast-export',
        [['--signed-tags', mode], { operand: 'HEAD' }],
        [`--signed-tags=${mode}`, 'HEAD'],
        true,
      );
    }
    compare(
      'fast-export',
      [
        ['--signed-tags', 'STRIP'],
        ['--signed-tags', 'strip'],
      ],
      ['--signed-tags=STRIP', '--signed-tags=strip'],
      false,
    );
    compare(
      'fast-export',
      [['--tag-of-filtered-object', 'REWRITE']],
      ['--tag-of-filtered-object=REWRITE'],
      false,
    );
    for (const value of ['yes', 'NO', 'ABORT', '2', '-1', '']) {
      compare(
        'fast-export',
        [['--reencode', value], { operand: 'HEAD' }],
        [`--reencode=${value}`, 'HEAD'],
        true,
      );
    }
    compare('fast-export', [['--reencode', 'unknown']], ['--reencode=unknown'], false);
    if (!legacy) {
      compare(
        'fast-export',
        [['--signed-commits', 'strip-if-invalid']],
        ['--signed-commits=strip-if-invalid'],
        false,
      );
    }
  });
});
