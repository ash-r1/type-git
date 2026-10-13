import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';
describe('file, ref and object inspection grammars', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  let branch: string;
  const direct = (args: string[], input = '') =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input,
      encoding: 'utf8',
      timeout: 10000,
    });
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-inspection-'));
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
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await writeFile(join(repo.workdir, '.gitignore'), '*.tmp\n');
    await writeFile(join(repo.workdir, '.gitattributes'), 'tracked text\n');
    await repo.add('.');
    await repo.commit({ message: 'initial' });
    branch = direct(['symbolic-ref', 'HEAD']).stdout.trim();
    const name = branch.replace('refs/heads/', '');
    expect(direct(['config', `branch.${name}.remote`, '.']).status).toBe(0);
    expect(direct(['config', `branch.${name}.merge`, branch]).status).toBe(0);
    expect(direct(['tag', 'v1']).status).toBe(0);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const compare = (
    command: GitCommandName,
    args: readonly unknown[],
    argv: string[],
    input = '',
  ) => {
    const actual = direct([command, ...argv], input);
    expect(actual.signal, `${command} ${argv.join(' ')}`).toBe(null);
    const build = () => commandArguments(command, args, true);
    if (actual.status === 0) {
      expect(build()).toEqual([command, ...argv]);
    } else {
      expect(build, `${command} ${argv.join(' ')}: ${actual.stderr}`).toThrow(GitArgumentError);
    }
  };
  const tuples = (flags: string[]) =>
    flags.map((flag) =>
      flag.includes('=')
        ? [flag.slice(0, flag.indexOf('=')), flag.slice(flag.indexOf('=') + 1)]
        : [flag],
    );

  it('runs common inspection commands through the public API', async () => {
    const cases: [GitCommandName, readonly unknown[], string[], string?][] = [
      ['ls-files', [['--stage']], ['--stage']],
      ['ls-remote', [['--refs'], { operand: repo.workdir }], ['--refs', repo.workdir]],
      ['ls-tree', [['-r'], { operand: 'HEAD' }], ['-r', 'HEAD']],
      ['for-each-ref', [['--format', '%(refname)']], ['--format=%(refname)']],
      ['show-ref', [['--verify'], { operand: branch }], ['--verify', branch]],
      ['symbolic-ref', [{ operand: 'HEAD' }], ['HEAD']],
      ['count-objects', [['--verbose']], ['--verbose']],
      ['describe', [['--always']], ['--always']],
      ['name-rev', [{ operand: 'HEAD' }], ['HEAD']],
      ['cherry', [{ operand: 'HEAD' }], ['HEAD']],
      // >3 cherry operands use the configured upstream; Git ignores all four words.
      ['cherry', ['a', 'b', 'c', 'd'].map((operand) => ({ operand })), ['a', 'b', 'c', 'd']],
      [
        'check-mailmap',
        [['--stdin'], { operand: 'Test <test@example.com>' }],
        ['--stdin', 'Test <test@example.com>'],
        'Other <other@example.com>\n',
      ],
      ['stripspace', [['--strip-comments']], ['--strip-comments'], '# comment\ntext  \n'],
      ['check-ref-format', [['--branch'], { operand: 'topic' }], ['--branch', 'topic']],
      [
        'check-ref-format',
        [['--normalize'], { operand: '/refs//heads/topic' }],
        ['--normalize', '/refs//heads/topic'],
      ],
    ];
    for (const [command, args, argv, input] of cases) {
      const expected = direct([command, ...argv], input);
      expect(expected.status, expected.stderr).toBe(0);
      expect(commandArguments(command, args, true)).toEqual([command, ...argv]);
      const result = await repo.command(command, args as never, { stdin: input });
      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toBe(expected.stdout);
    }
  });

  it('matches check-attr operand partitioning and check-ignore flag combinations', () => {
    for (const all of [false, true]) {
      for (const stdin of [false, true]) {
        for (const separated of [false, true]) {
          for (const count of [0, 1, 2]) {
            for (const files of [0, 1]) {
              if (!separated && files) {
                continue;
              }
              const words = ['text', 'diff'].slice(0, count);
              const flags = [...(all ? ['--all'] : []), ...(stdin ? ['--stdin'] : [])];
              const paths = files ? ['tracked'] : [];
              compare(
                'check-attr',
                [
                  ...tuples(flags),
                  ...words.map((operand) => ({ operand })),
                  ...(separated ? [['--'], ...paths.map((operand) => ({ operand }))] : []),
                ],
                [...flags, ...words, ...(separated ? ['--', ...paths] : [])],
                'tracked\n',
              );
            }
          }
        }
      }
    }
    compare(
      'check-ignore',
      [['--quiet'], ['--no-quiet'], ['--verbose'], { operand: 'ignored.tmp' }],
      ['--quiet', '--no-quiet', '--verbose', 'ignored.tmp'],
    );
    compare(
      'check-ignore',
      [['--verbose'], ['--no-verbose'], ['--non-matching'], { operand: 'ignored.tmp' }],
      ['--verbose', '--no-verbose', '--non-matching', 'ignored.tmp'],
    );
    const domain = ['--quiet', '--verbose', '--stdin', '-z', '--non-matching'];
    for (let mask = 0; mask < 32; mask++) {
      const flags = domain.filter((_, i) => mask & (1 << i));
      const paths = flags.includes('--stdin') ? [] : ['ignored.tmp'];
      compare(
        'check-ignore',
        [...tuples(flags), ...paths.map((operand) => ({ operand }))],
        [...flags, ...paths],
        flags.includes('-z') ? 'ignored.tmp\0' : 'ignored.tmp\n',
      );
    }
    compare(
      'check-attr',
      [['-z'], { operand: 'text' }, { operand: 'tracked' }],
      ['-z', 'text', 'tracked'],
    );
  });

  it.skipIf(legacy)('preserves ls-files validation order and ls-tree native modes', () => {
    for (const flags of [
      ['--format=%(path)', '--stage'],
      ['--format=%(path)', '--unmerged'],
      ['--format=%(path)', '-v'],
      ['--format=%(path)', '--stage', '--no-stage'],
      ['--ignored'],
      ['--ignored', '--cached'],
      ['--ignored', '--cached', '--exclude='],
      ['--ignored', '--others', '--exclude-standard'],
      ['--recurse-submodules', '--modified'],
      ['--recurse-submodules', '--modified', '--no-modified'],
      ['--with-tree=HEAD', '--unmerged'],
      ['--with-tree=HEAD', '--stage', '--no-stage'],
    ]) {
      compare('ls-files', tuples(flags), flags);
    }
    for (const flags of [
      ['--name-only', '--name-status'],
      ['--name-only', '--name-only'],
      ['--format=%(path)', '--long'],
      ['--format=%(path)', '--name-only'],
      ['--format=%(path)', '-r'],
    ]) {
      compare('ls-tree', [...tuples(flags), { operand: 'HEAD' }], [...flags, 'HEAD']);
    }
  });

  it.skipIf(legacy)('preserves default sorting, clearing and input source constraints', () => {
    for (const flags of [
      ['--shell', '--python'],
      ['--shell', '--python', '--no-shell'],
      ['--start-after=refs/heads/a', '--sort=refname'],
      ['--start-after=refs/heads/a', '--no-sort', '--sort=refname'],
      ['--start-after=refs/heads/a', '--no-sort', '--sort=refname', '--sort=objectname'],
    ]) {
      compare('for-each-ref', tuples(flags), flags);
    }
    compare('for-each-ref', [['--stdin'], { operand: 'refs/heads' }], ['--stdin', 'refs/heads']);
    for (const flags of [
      ['--all', '--annotate-stdin'],
      ['--stdin', '--no-annotate-stdin', '--all'],
      ['--stdin', '--no-stdin', '--all'],
    ]) {
      compare('name-rev', tuples(flags), flags);
    }
    for (const flags of [
      ['--exists', '--verify'],
      ['--exists', '--exists'],
    ]) {
      compare('show-ref', [...tuples(flags), { operand: branch }], [...flags, branch]);
    }
    compare(
      'show-ref',
      [['--exclude-existing'], { operand: 'ignored' }],
      ['--exclude-existing', 'ignored'],
    );
  });

  it('checks describe delegation, zero abbreviation and hand-written operand grammars', () => {
    compare(
      'describe',
      [['--always'], ['--long'], ['--abbrev', 0]],
      ['--always', '--long', '--abbrev=0'],
    );
    compare(
      'describe',
      [['--always'], ['--long'], ['--abbrev', -1]],
      ['--always', '--long', '--abbrev=-1'],
    );
    compare(
      'describe',
      [['--always'], ['--dirty'], { operand: 'HEAD' }],
      ['--always', '--dirty', 'HEAD'],
    );
    compare(
      'describe',
      [['--contains'], ['--dirty'], { operand: 'HEAD' }],
      ['--contains', '--dirty', 'HEAD'],
    );
    compare(
      'check-ref-format',
      [['--branch'], ['--normalize'], { operand: 'topic' }],
      ['--branch', '--normalize', 'topic'],
    );
    compare('symbolic-ref', [['-m', ''], { operand: 'HEAD' }], ['-m', '', 'HEAD']);
    compare('symbolic-ref', [['--delete'], { operand: 'HEAD' }], ['--delete', 'HEAD']);
    for (const command of ['count-objects', 'stripspace'] as const) {
      compare(command, [{ operand: 'extra' }], ['extra']);
    }
    for (const command of [
      'verify-tag',
      'verify-commit',
      'verify-pack',
      'ls-tree',
      'unpack-file',
    ] as const) {
      compare(command, [], []);
    }
  });

  it('preserves ignored operands and text object protocols', async () => {
    const head = direct(['rev-parse', 'HEAD']).stdout.trim();
    const tag = `object ${head}\ntype commit\ntag generated\ntagger Test <test@example.com> 1700000000 +0000\n\nmessage\n`;
    for (const [command, input] of [
      ['write-tree', ''],
      ['mktree', ''],
      ['mktag', tag],
      ['show-index', '\0'.repeat(1024)],
      ['patch-id', ''],
    ] as const) {
      // Older manual parsers rejected operands that 2.55 now ignores.
      const operands =
        legacy && (command === 'mktag' || command === 'show-index' || command === 'patch-id')
          ? []
          : ['ignored'];
      const expected = direct([command, ...operands], input);
      expect(expected.status, expected.stderr).toBe(0);
      const result = await repo.command(
        command,
        operands.map((operand) => ({ operand })) as never,
        {
          stdin: input,
        },
      );
      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toBe(expected.stdout);
    }
    const blob = direct(['rev-parse', 'HEAD:tracked']).stdout.trim();
    const result = await repo.command('unpack-file', [{ operand: blob }]);
    expect(result.exitCode, result.stderr).toBe(0);
    const file = join(repo.workdir, result.stdout.trim());
    expect(await readFile(file, 'utf8')).toBe('one\n');
    await rm(file);
    for (const command of ['verify-commit', 'verify-tag'] as const) {
      // Unsigned objects fail verification, but their invocation is valid.
      const object = command === 'verify-tag' ? 'v1' : 'HEAD';
      const actual = direct([command, object]);
      const wrapped = await repo.command(command, [{ operand: object }] as never);
      expect(wrapped.exitCode).toBe(actual.status);
    }
    expect(direct(['repack', '-ad']).status).toBe(0);
    const index = (await readdir(join(repo.workdir, '.git', 'objects', 'pack'))).find((f) =>
      f.endsWith('.idx'),
    );
    if (!index) {
      throw new Error('Missing generated pack index');
    }
    const verified = await repo.command('verify-pack', [
      ['--stat-only'],
      { operand: join('.git', 'objects', 'pack', index) },
    ]);
    expect(verified.exitCode, verified.stderr).toBe(0);
  });

  it.skipIf(legacy)('checks format-rev final values and streams revisions', async () => {
    compare(
      'format-rev',
      [
        ['--format', '%H'],
        ['--stdin-mode', 'bad'],
        ['--stdin-mode', 'revs'],
      ],
      ['--format=%H', '--stdin-mode=bad', '--stdin-mode=revs'],
    );
    compare(
      'format-rev',
      [
        ['--format', '%H'],
        ['--stdin-mode', 'bad'],
      ],
      ['--format=%H', '--stdin-mode=bad'],
    );
    compare('format-rev', [['--format', '%H']], ['--format=%H']);
    const expected = direct(['format-rev', '--format=%H', '--stdin-mode=rev'], 'HEAD\n');
    expect(expected.status, expected.stderr).toBe(0);
    const result = await repo.command(
      'format-rev',
      [
        ['--format', '%H'],
        ['--stdin-mode', 'rev'],
      ],
      { stdin: 'HEAD\n' },
    );
    expect(result.stdout).toBe(expected.stdout);
  });
});
