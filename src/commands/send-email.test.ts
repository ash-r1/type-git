import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

describe('send-email option phases without delivery', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  let patch: string;
  let unavailable: string | undefined;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-mail-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_GLOBAL: join(root, '.gitconfig'),
      GIT_CONFIG_NOSYSTEM: '1',
      LC_ALL: 'C',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'author@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'author@example.com',
    };
    await writeFile(join(root, '.gitconfig'), '');
    const probe = spawnSync('git', ['send-email', '-h'], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(probe.error).toBeUndefined();
    expect(probe.signal).toBeNull();
    expect(probe.status).not.toBeNull();
    const diagnostic = probe.stdout + probe.stderr;
    if (diagnostic.includes("git: 'send-email' is not a git command")) {
      expect(probe.status).toBe(1);
      unavailable = 'Selected Git does not install send-email.';
    } else if (/Can't locate [\w/]+\.pm in @INC/.test(diagnostic)) {
      expect(probe.status).not.toBe(0);
      unavailable = diagnostic;
    } else {
      expect(probe.status, diagnostic).toBe(1);
      expect(diagnostic).toContain('git send-email');
    }
    if (unavailable) {
      console.warn(`Skipping native send-email checks: ${unavailable}`);
    }
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await repo.add('.');
    await repo.commit({ message: 'fixture' });
    patch = join(root, 'fixture.patch');
    const exported = spawnSync(
      'git',
      ['-C', repo.workdir, 'format-patch', '--root', '--stdout', 'HEAD'],
      { env, input: '', encoding: 'utf8', timeout: 10000 },
    );
    expect(exported.error).toBeUndefined();
    expect(exported.signal).toBeNull();
    expect(exported.status).toBe(0);
    await writeFile(patch, exported.stdout);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const compare = (
    args: readonly unknown[],
    argv: string[],
    valid: boolean,
    diagnostic?: string | RegExp,
  ) => {
    const native = spawnSync('git', ['-C', repo.workdir, 'send-email', ...argv], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });
    const label = `${argv.join(' ')}: ${native.stderr}`;
    expect(native.error, label).toBeUndefined();
    expect(native.signal, label).toBe(null);
    expect(native.status, label).not.toBeNull();
    expect(native.status === 0, label).toBe(valid);
    const build = () => commandArguments('send-email', args, true);
    if (valid) {
      expect(build()).toEqual(['send-email', ...argv]);
    } else {
      expect(native.status, label).toBe(1);
      expect(diagnostic).toBeDefined();
      expect(native.stderr, label).toMatch(diagnostic!);
      expect(build, label).toThrow(GitArgumentError);
    }
  };
  it('permits identity selection for alias inspection and rejects ordinary options in that phase', ({
    skip,
  }) => {
    if (unavailable) {
      skip();
      return;
    }
    compare(
      [['--identity', 'fixture'], ['--dump-aliases']],
      ['--identity=fixture', '--dump-aliases'],
      true,
    );
    compare(
      [['--dump-aliases'], ['--translate-aliases']],
      ['--dump-aliases', '--translate-aliases'],
      false,
      /--dump-aliases.*(?:incompatible|mutually exclusive)/,
    );
    compare(
      [['--dump-aliases'], ['--dry-run']],
      ['--dump-aliases', '--dry-run'],
      false,
      '--dump-aliases incompatible',
    );
    compare(
      [['--dump-aliases'], { operand: 'file' }],
      ['--dump-aliases', 'file'],
      false,
      '--dump-aliases incompatible',
    );
    compare([['--no-identity'], ['--dump-aliases']], ['--no-identity', '--dump-aliases'], true);
  });
  it('checks final confirmation prefixes and each suppression field in dry-run mode', ({
    skip,
  }) => {
    if (unavailable) {
      skip();
      return;
    }
    const common: readonly unknown[] = [
      ['--dry-run'],
      ['--from', 'author@example.com'],
      ['--to', 'recipient@example.com'],
      ['--no-validate'],
    ];
    const words = [
      '--dry-run',
      '--from=author@example.com',
      '--to=recipient@example.com',
      '--no-validate',
    ];
    for (const value of ['never', 'never-trailing']) {
      compare(
        [...common, ['--confirm', value], { operand: patch }],
        [...words, `--confirm=${value}`, patch],
        true,
      );
    }
    for (const field of [
      'all',
      'cccmd',
      'cc',
      'author',
      'self',
      'sob',
      'body',
      'bodycc',
      'misc-by',
    ].map((value) => `${value}\n`)) {
      compare(
        [...common, ['--confirm', 'never'], ['--suppress-cc', field], { operand: patch }],
        [...words, '--confirm=never', `--suppress-cc=${field}`, patch],
        true,
      );
    }
    for (const field of ['author\r\n', 'author\n\n']) {
      compare(
        [...common, ['--confirm', 'never'], ['--suppress-cc', field], { operand: patch }],
        [...words, '--confirm=never', `--suppress-cc=${field}`, patch],
        false,
        'Unknown --suppress-cc field:',
      );
    }
    compare(
      [...common, ['--confirm', 'invalid'], ['--confirm', 'never'], { operand: patch }],
      [...words, '--confirm=invalid', '--confirm=never', patch],
      true,
    );
    compare(
      [...common, ['--confirm', 'NEVER'], { operand: patch }],
      [...words, '--confirm=NEVER', patch],
      false,
      "Unknown --confirm setting: 'NEVER'",
    );
    compare(
      [
        ...common,
        ['--confirm', 'never'],
        ['--suppress-cc', 'author'],
        ['--suppress-cc', 'bad'],
        { operand: patch },
      ],
      [...words, '--confirm=never', '--suppress-cc=author', '--suppress-cc=bad', patch],
      false,
      "Unknown --suppress-cc field: 'bad'",
    );
    compare(
      [['--suppress-cc', 'bad'], ['--git-completion-helper']],
      ['--suppress-cc=bad', '--git-completion-helper'],
      true,
    );
  });
  it('allows configuration to supply the batch size required by a CLI relogin delay', async ({
    skip,
  }) => {
    if (unavailable) {
      skip();
      return;
    }
    await writeFile(join(root, '.gitconfig'), '[sendemail]\n\tsmtpBatchSize = 2\n');
    const args = [
      ['--dry-run'],
      ['--from', 'author@example.com'],
      ['--to', 'recipient@example.com'],
      ['--no-validate'],
      ['--confirm', 'never'],
      ['--relogin-delay', 0],
      { operand: patch },
    ];
    const words = [
      '--dry-run',
      '--from=author@example.com',
      '--to=recipient@example.com',
      '--no-validate',
      '--confirm=never',
      '--relogin-delay=0',
      patch,
    ];
    compare(args, words, true);
  });
});
