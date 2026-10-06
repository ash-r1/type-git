import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

const cvsServerAvailable =
  spawnSync('git', ['cvsserver', '--version'], { encoding: 'utf8' }).status === 0;
describe('foreign VCS frontend parsing', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-foreign-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_GLOBAL: join(root, 'global'),
      GIT_CONFIG_NOSYSTEM: '1',
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const direct = (args: string[]) =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });
  it('uses Arch implemented options rather than the advertised but unsupported -o', () => {
    const missing = direct(['archimport']);
    expect(missing.error).toBeUndefined();
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('usage: git archimport');
    expect(() => commandArguments('archimport', [], true)).toThrow(GitArgumentError);
    const unsupported = direct(['archimport', '-o', 'branch']);
    expect(unsupported.stderr).toContain('Unknown option: o');
    expect(() => commandArguments('archimport', [['-o']], true)).toThrow(GitArgumentError);
    const argv = commandArguments('archimport', [['-D', 'not-an-integer'], ['-h']], true);
    expect(argv).toEqual(['archimport', '-D', 'not-an-integer', '-h']);
    expect(direct(argv).stderr).toContain('usage: git archimport');
  });
  it('keeps CVS import values as strings and enforces the one-module limit before transport', () => {
    const result = direct(['cvsimport', 'one', 'two']);
    expect(result.error).toBeUndefined();
    expect(result.stderr).toContain('more than one CVS module');
    expect(() =>
      commandArguments('cvsimport', [{ operand: 'one' }, { operand: 'two' }], true),
    ).toThrow(GitArgumentError);
    const argv = commandArguments(
      'cvsimport',
      [['-M', 'one'], ['-M', 'two'], ['-z', 'nonnumeric'], ['-h']],
      true,
    );
    expect(argv).toEqual(['cvsimport', '-M', 'one', '-M', 'two', '-z', 'nonnumeric', '-h']);
    expect(direct(argv).stderr).toContain('usage: git cvsimport');
  });
  it('does not impose a two-commit maximum on CVS export before its checkout validation', () => {
    expect(direct(['cvsexportcommit']).stderr).toContain('Need at least one commit identifier');
    expect(() => commandArguments('cvsexportcommit', [], true)).toThrow(GitArgumentError);
    for (const words of [['commit'], ['parent', 'commit'], ['ignored', 'parent', 'commit']]) {
      const argv = commandArguments(
        'cvsexportcommit',
        [['-w', root], ...words.map((operand) => ({ operand }))],
        true,
      );
      const result = direct(argv);
      expect(result.error).toBeUndefined();
      expect(result.stderr).toContain('is not a CVS checkout');
      expect(argv).toEqual(['cvsexportcommit', '-w', root, ...words]);
    }
  });
  it.skipIf(!cvsServerAvailable)(
    'requires explicit export roots and honors version before root checks',
    () => {
      for (const words of [[], ['server'], ['pserver']]) {
        const result = direct(['cvsserver', '--export-all', ...words]);
        expect(result.error).toBeUndefined();
        expect(result.stderr).toContain('--export-all can only be used');
        expect(() =>
          commandArguments(
            'cvsserver',
            [['--export-all'], ...words.map((operand) => ({ operand }))],
            true,
          ),
        ).toThrow(GitArgumentError);
      }
      const argv = commandArguments('cvsserver', [['--export-all'], ['--version']], true);
      expect(direct(argv).status).toBe(0);
      const server = commandArguments(
        'cvsserver server',
        [['--export-all'], { operand: root }],
        true,
      );
      expect(direct(server).status).toBe(0);
    },
  );
});
