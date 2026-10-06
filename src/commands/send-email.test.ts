import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

const available = !spawnSync('git', ['send-email', '-h'], { encoding: 'utf8' }).stderr.includes(
  'is not a git command',
);
describe.skipIf(!available)('send-email option phases without delivery', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  let patch: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-mail-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_GLOBAL: join(root, '.gitconfig'),
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'author@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'author@example.com',
    };
    await writeFile(join(root, '.gitconfig'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await repo.add('.');
    await repo.commit({ message: 'fixture' });
    patch = join(root, 'fixture.patch');
    const exported = spawnSync(
      'git',
      ['-C', repo.workdir, 'format-patch', '--root', '--stdout', 'HEAD'],
      { env, encoding: 'utf8' },
    );
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
    overlay: NodeJS.ProcessEnv = {},
  ) => {
    const native = spawnSync('git', ['-C', repo.workdir, 'send-email', ...argv], {
      env: { ...env, ...overlay },
      encoding: 'utf8',
      timeout: 10000,
    });
    const label = `${argv.join(' ')}: ${native.stderr}`;
    expect(native.error, label).toBeUndefined();
    expect(native.signal, label).toBe(null);
    expect(native.status === 0, label).toBe(valid);
    const build = () => commandArguments('send-email', args, true);
    if (valid) {
      expect(build()).toEqual(['send-email', ...argv]);
    } else {
      expect(build, label).toThrow(GitArgumentError);
    }
  };
  it('permits identity selection for alias inspection and rejects ordinary options in that phase', () => {
    compare(
      [['--identity', 'fixture'], ['--dump-aliases']],
      ['--identity=fixture', '--dump-aliases'],
      true,
    );
    compare(
      [['--dump-aliases'], ['--translate-aliases']],
      ['--dump-aliases', '--translate-aliases'],
      false,
    );
    compare([['--dump-aliases'], ['--dry-run']], ['--dump-aliases', '--dry-run'], false);
    compare([['--dump-aliases'], { operand: 'file' }], ['--dump-aliases', 'file'], false);
    compare([['--no-identity'], ['--dump-aliases']], ['--no-identity', '--dump-aliases'], true);
  });
  it('checks final confirmation prefixes and each suppression field in dry-run mode', () => {
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
    compare(
      [...common, ['--confirm', 'invalid'], ['--confirm', 'never'], { operand: patch }],
      [...words, '--confirm=invalid', '--confirm=never', patch],
      true,
    );
    compare(
      [...common, ['--confirm', 'NEVER'], { operand: patch }],
      [...words, '--confirm=NEVER', patch],
      false,
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
    );
    compare(
      [['--suppress-cc', 'bad'], ['--git-completion-helper']],
      ['--suppress-cc=bad', '--git-completion-helper'],
      true,
    );
  });
  it('allows configuration to supply the batch size required by a CLI relogin delay', async () => {
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
