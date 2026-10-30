import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import {
  access,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NodeExecAdapter, NodeFsAdapter, TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { createGitSync } from '../impl/git-impl.js';

describe('diff-tree sole full usage and diff controls', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  const native = (args: string[]) => {
    const result = spawnSync('git', ['-C', root, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return result;
  };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-diff-tree-help-'));
    env = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] =>
            entry[1] !== undefined && !entry[0].toUpperCase().startsWith('GIT_'),
        ),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      LC_ALL: 'C',
      GIT_EDITOR: 'fixture-editor',
      GIT_PAGER: 'fixture-pager',
      GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
    };
    for (const args of [
      ['init', '-q'],
      ['config', 'user.name', 'Fixture'],
      ['config', 'user.email', 'fixture@example.invalid'],
    ]) {
      expect(native(args).status).toBe(0);
    }
    await writeFile(join(root, 'file'), 'base\n');
    await writeFile(join(root, '--help'), 'distinct dash file\n');
    expect(native(['add', '--', 'file', '--help']).status).toBe(0);
    expect(native(['commit', '-qm', 'base']).status).toBe(0);
    await writeFile(join(root, 'file'), 'next\n');
    expect(native(['add', '--', 'file']).status).toBe(0);
    expect(native(['commit', '-qm', 'second']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  const compare = async (
    args: readonly unknown[],
    words: string[],
    input: string | Uint8Array = '',
    outside = false,
    outsideParent = tmpdir(),
    selected?: { gitBinary: string; env: Record<string, string> },
  ) => {
    const snapshot = () =>
      Promise.all([
        readdir(root).then((entries) => entries.sort()),
        ...['.git/index', 'file', '.git/HEAD', '.git/config'].map((path) =>
          readFile(join(root, path)),
        ),
      ]);
    const cwd = outside ? await mkdtemp(join(outsideParent, 'type-git-diff-tree-outside-')) : root;
    const gitBinary = selected?.gitBinary ?? 'git';
    const baseEnv = selected?.env ?? env;
    const commandEnv = outside ? { ...baseEnv, GIT_CEILING_DIRECTORIES: dirname(cwd) } : baseEnv;
    const before = await snapshot();
    try {
      if (outside) {
        const discovery = spawnSync(gitBinary, ['-C', cwd, 'rev-parse', '--is-inside-work-tree'], {
          env: commandEnv,
          encoding: 'utf8',
          timeout: 30_000,
        });
        expect(discovery.error).toBeUndefined();
        expect(discovery.status).toBe(128);
        expect(discovery.stderr).toContain('not a git repository');
      }
      const expected = spawnSync(gitBinary, ['-C', cwd, 'diff-tree', ...words], {
        env: commandEnv,
        input,
        encoding: 'utf8',
        timeout: 30_000,
      });
      expect(expected.error).toBeUndefined();
      expect(expected.signal).toBeNull();
      expect(await snapshot()).toEqual(before);
      const exec = new NodeExecAdapter();
      const spawn = exec.spawn.bind(exec);
      exec.spawn = (options) => spawn({ ...options, cwd });
      const git = outside
        ? new TypeGit(
            createGitSync({
              adapters: { exec, fs: new NodeFsAdapter() },
              gitBinary,
              home: root,
              inheritEnv: false,
              env: commandEnv,
            }),
          )
        : selected
          ? await new TypeGit({ gitBinary, home: root, inheritEnv: false, env: commandEnv }).open(
              root,
            )
          : repo;
      const actual = await git.command('diff-tree', args as never, { stdin: input });
      expect(await snapshot()).toEqual(before);
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
      return expected;
    } finally {
      if (outside) {
        await rm(cwd, { recursive: true, force: true });
      }
    }
  };
  it('matches selected native sole usage and ordinary commit diff', async () => {
    for (const outside of [false, true]) {
      await compare([['--help-all']], ['--help-all'], '', outside);
      await compare([['-h']], ['-h'], '', outside);
      await compare([{ operand: 'HEAD' }], ['HEAD'], '', outside);
      await compare([['--name-only'], { operand: 'HEAD' }], ['--name-only', 'HEAD'], '', outside);
      await compare([['--root'], { operand: 'HEAD' }], ['--root', 'HEAD'], '', outside);
      await compare(
        [['--exit-code'], { operand: 'HEAD^' }, { operand: 'HEAD' }],
        ['--exit-code', 'HEAD^', 'HEAD'],
        '',
        outside,
      );
    }
  }, 120_000);
  it('uses the explicitly selected executable when PATH git has different behavior', async () => {
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
    const executableName = process.platform === 'win32' ? 'git.exe' : 'git';
    const blocked = join(root, 'non-executable-bin');
    await mkdir(blocked);
    const blockedGit = join(blocked, executableName);
    if (process.platform === 'win32') {
      await mkdir(blockedGit);
    } else {
      await writeFile(blockedGit, 'not an executable\n', { mode: 0o644 });
      await chmod(blockedGit, 0o644);
    }
    const originalPath = env[pathKey] ?? '';
    // Exercise quoted native Windows PATH entries, including Git installations with spaces.
    const quotedPath =
      process.platform === 'win32'
        ? originalPath
            .split(delimiter)
            .map((directory) => `"${directory.replace(/^["']|["']$/g, '')}"`)
            .join(delimiter)
        : originalPath;
    const searchPath = `${blocked}${delimiter}${quotedPath}`;
    let gitBinary: string | undefined;
    for (const directory of searchPath.split(delimiter)) {
      // libuv's Windows search strips boundary quotes; POSIX treats quotes literally.
      const nativeDirectory =
        process.platform === 'win32' ? directory.replace(/^["']|["']$/g, '') : directory;
      const candidate = resolve(nativeDirectory, executableName);
      try {
        if (!(await stat(candidate)).isFile()) {
          continue;
        }
        await access(candidate, constants.X_OK);
        gitBinary = candidate;
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code ?? '';
        if (!['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(code)) {
          throw error;
        }
      }
    }
    if (!gitBinary) {
      throw new Error('The fixture requires the Git executable already used for repository setup');
    }
    const shadow = join(root, 'shadow-bin');
    await mkdir(shadow);
    const shadowGit = join(shadow, executableName);
    await copyFile(process.execPath, shadowGit);
    if (process.platform !== 'win32') {
      await chmod(shadowGit, 0o755);
    }
    const selectedEnv = { ...env, [pathKey]: `${shadow}${delimiter}${searchPath}` };
    try {
      const pathGit = spawnSync('git', ['-C', root, 'diff-tree', '--help-all'], {
        env: { ...env, [pathKey]: searchPath },
        input: '',
        encoding: 'utf8',
        timeout: 30_000,
      });
      expect(pathGit.error).toBeUndefined();
      expect(pathGit.signal).toBeNull();
      const defaultGit = spawnSync('git', ['-C', root, 'diff-tree', '--help-all'], {
        env: selectedEnv,
        input: '',
        encoding: 'utf8',
        timeout: 30_000,
      });
      expect(defaultGit.error).toBeUndefined();
      expect(defaultGit.signal).toBeNull();
      for (const outside of [false, true]) {
        const expected = await compare([['--help-all']], ['--help-all'], '', outside, tmpdir(), {
          gitBinary,
          env: selectedEnv,
        });
        if (!outside) {
          expect([pathGit.status, pathGit.stdout, pathGit.stderr]).toEqual([
            expected.status,
            expected.stdout,
            expected.stderr,
          ]);
        }
        expect([defaultGit.status, defaultGit.stdout, defaultGit.stderr]).not.toEqual([
          expected.status,
          expected.stdout,
          expected.stderr,
        ]);
      }
    } finally {
      await rm(shadow, { recursive: true, force: true });
      await rm(blocked, { recursive: true, force: true });
    }
  }, 120_000);
  it('pins committed payloads independently of unstaged worktree changes', async () => {
    const revision = native(['rev-parse', '--verify', 'HEAD']);
    expect(revision.status).toBe(0);
    expect(revision.stdout.trim()).toMatch(/^[0-9a-f]{40}$/);
    const one = await compare([['--name-only'], { operand: 'HEAD' }], ['--name-only', 'HEAD']);
    expect(one.status).toBe(0);
    expect(one.stdout).toBe(`${revision.stdout}file\n`);
    const names = await compare(
      [['--name-only'], { operand: 'HEAD^' }, { operand: 'HEAD' }],
      ['--name-only', 'HEAD^', 'HEAD'],
    );
    expect(names.status).toBe(0);
    expect(names.stdout).toBe('file\n');
    await writeFile(join(root, 'file'), 'unstaged ignored content\n');
    try {
      const patch = await compare(
        [['--patch'], ['--no-commit-id'], { operand: 'HEAD^' }, { operand: 'HEAD' }],
        ['--patch', '--no-commit-id', 'HEAD^', 'HEAD'],
      );
      expect(patch.status).toBe(0);
      expect(patch.stdout).toContain('+next\n');
      expect(patch.stdout).not.toContain('unstaged ignored content');
      const changed = await compare(
        [['--exit-code'], { operand: 'HEAD^' }, { operand: 'HEAD' }],
        ['--exit-code', 'HEAD^', 'HEAD'],
      );
      expect(changed.status).toBe(1);
      expect(changed.stdout).toMatch(/:100644 100644 [0-9a-f]+ [0-9a-f]+ M\tfile/);
    } finally {
      await writeFile(join(root, 'file'), 'next\n');
    }
  }, 120_000);
  it('keeps nested outside controls outside the repository', async () => {
    await compare([['--help-all']], ['--help-all'], '', true, root);
    await compare([{ operand: 'HEAD' }], ['HEAD'], '', true, root);
  }, 120_000);
});
