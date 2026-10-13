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

const nativeVersion = spawnSync('git', ['version'], { encoding: 'utf8' });
const versionMatch = /git version (\d+)\.(\d+)/.exec(nativeVersion.stdout);
if (nativeVersion.error || nativeVersion.signal || nativeVersion.status !== 0 || !versionMatch) {
  throw new Error('Cannot inspect selected Git version');
}
const native247 =
  Number(versionMatch[1]) > 2 || (Number(versionMatch[1]) === 2 && Number(versionMatch[2]) >= 47);
const native255 =
  Number(versionMatch[1]) > 2 || (Number(versionMatch[1]) === 2 && Number(versionMatch[2]) >= 55);
const packHelpResult = spawnSync('git', ['pack-objects', '-h'], {
  encoding: 'utf8',
  env: { ...process.env, LC_ALL: 'C' },
});
if (packHelpResult.error || packHelpResult.signal || packHelpResult.status !== 129) {
  throw new Error('Cannot inspect selected pack-objects options');
}
const packHelp = (packHelpResult.stdout + packHelpResult.stderr).replaceAll('--[no-]', '--');
describe('pack command constraints', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  let pack: Buffer;
  let packPath: string;
  const direct = (args: string[], input: string | Uint8Array = '') =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input,
      encoding: 'utf8',
      timeout: 10000,
    });
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-pack-'));
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
      LC_ALL: 'C',
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
    const object = direct(['rev-parse', 'HEAD:tracked']);
    expect(object.status).toBe(0);
    const packed = spawnSync('git', ['-C', repo.workdir, 'pack-objects', '--stdout'], {
      env,
      input: `${object.stdout.trim()}\n`,
      timeout: 10000,
    });
    expect(packed.status).toBe(0);
    pack = packed.stdout;
    expect(pack.readUInt32BE(8)).toBe(1);
    packPath = join(root, 'fixture.pack');
    await writeFile(packPath, pack);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const compare = (
    command: GitCommandName,
    args: readonly unknown[],
    argv: string[],
    valid: boolean,
    input: string | Uint8Array = '',
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

  it('matches pack destination, compression and transfer restrictions', () => {
    compare('pack-objects', [], [], false);
    compare('pack-objects', [['--stdout']], ['--stdout'], true);
    compare('pack-objects', [['--stdout'], { operand: 'extra' }], ['--stdout', 'extra'], false);
    compare('pack-objects', [{ operand: join(root, 'output') }], [join(root, 'output')], true);
    compare(
      'pack-objects',
      [['--thin'], { operand: join(root, 'thin') }],
      ['--thin', join(root, 'thin')],
      false,
    );
    compare('pack-objects', [['--thin'], ['--stdout']], ['--thin', '--stdout'], true);
    compare(
      'pack-objects',
      [['--stdout'], ['--max-pack-size', 1]],
      ['--stdout', '--max-pack-size=1'],
      false,
    );
    compare(
      'pack-objects',
      [['--stdout'], ['--max-pack-size', 0]],
      ['--stdout', '--max-pack-size=0'],
      true,
    );
    for (const level of [-2, -1, 0, 9, 10]) {
      compare(
        'pack-objects',
        [['--stdout'], ['--compression', level]],
        ['--stdout', `--compression=${level}`],
        level >= -1 && level <= 9,
      );
    }
    compare(
      'pack-objects',
      [['--stdout'], ['--compression', 10], ['--compression', 1]],
      ['--stdout', '--compression=10', '--compression=1'],
      true,
    );
    compare(
      'pack-objects',
      [['--stdout'], ['--depth', -2], ['--window', -2]],
      ['--stdout', '--depth=-2', '--window=-2'],
      true,
    );
    compare(
      'pack-objects',
      [['--stdout'], ['--keep-unreachable'], ['--unpack-unreachable']],
      ['--stdout', '--keep-unreachable', '--unpack-unreachable'],
      false,
    );
  });
  it.skipIf(!native255)('checks signed int bounds before a later valid overwrite', () => {
    for (const flag of ['--compression', '--depth', '--window', '--threads']) {
      for (const value of [-2147483649, 2147483648, -2147483648, 2147483647]) {
        compare(
          'pack-objects',
          [['--stdout'], [flag, value], [flag, 1]],
          ['--stdout', `${flag}=${value}`, `${flag}=1`],
          value >= -2147483648 && value <= 2147483647,
        );
      }
    }
  });
  it.skipIf(!packHelp.includes('--stdin-packs') || !packHelp.includes('--cruft'))(
    'matches stdin packs and cruft revision-mode implications',
    () => {
      compare(
        'pack-objects',
        [['--stdout'], ['--stdin-packs']],
        ['--stdout', '--stdin-packs'],
        true,
      );

      for (const flag of [
        '--revs',
        '--all',
        '--reflog',
        '--indexed-objects',
        '--keep-unreachable',
        '--pack-loose-unreachable',
        '--thin',
      ]) {
        compare(
          'pack-objects',
          [['--stdout'], ['--stdin-packs'], [flag]],
          ['--stdout', '--stdin-packs', flag],
          false,
        );
      }
      compare(
        'pack-objects',
        [['--stdout'], ['--stdin-packs'], ['--unpacked']],
        ['--stdout', '--stdin-packs', '--unpacked'],
        true,
      );

      compare(
        'pack-objects',
        [['--stdout'], ['--stdin-packs'], ['--filter', 'blob:none']],
        ['--stdout', '--stdin-packs', '--filter=blob:none'],
        false,
      );
      compare(
        'pack-objects',
        [['--stdout'], ['--stdin-packs'], ['--filter', 'blob:none'], ['--no-filter']],
        ['--stdout', '--stdin-packs', '--filter=blob:none', '--no-filter'],
        true,
      );
      const prefix = join(root, 'cruft');
      compare('pack-objects', [['--cruft'], { operand: prefix }], ['--cruft', prefix], true);
      for (const flag of ['--revs', '--all', '--unpacked', '--stdin-packs']) {
        compare(
          'pack-objects',
          [['--cruft'], [flag], { operand: prefix }],
          ['--cruft', flag, prefix],
          false,
        );
      }
      compare(
        'pack-objects',
        [['--cruft-expiration', 'now'], ['--all'], { operand: prefix }],
        ['--cruft-expiration=now', '--all', prefix],
        false,
      );
      compare(
        'pack-objects',
        [['--cruft-expiration', 'now'], ['--no-cruft'], ['--all'], ['--stdout']],
        ['--cruft-expiration=now', '--no-cruft', '--all', '--stdout'],
        true,
      );
    },
  );
  it.skipIf(!native255)('accepts promisor exclusion with stdin packs in modern Git', () => {
    compare(
      'pack-objects',
      [['--stdout'], ['--stdin-packs'], ['--exclude-promisor-objects']],
      ['--stdout', '--stdin-packs', '--exclude-promisor-objects'],
      true,
    );
  });
  it.skipIf(!packHelp.includes('--stdin-packs[='))(
    'accepts the optional stdin-pack mode value',
    () => {
      compare(
        'pack-objects',
        [['--stdout'], ['--stdin-packs', '']],
        ['--stdout', '--stdin-packs='],
        true,
      );
    },
  );
  it.skipIf(!native255)('rejects an explicit promisor pack name in the modern parser', () => {
    compare('index-pack', [['--promisor'], { operand: packPath }], ['--promisor', packPath], false);
  });
  it('matches manual index-pack modes and immediate singleton callbacks', () => {
    compare('index-pack', [], [], false);
    compare('index-pack', [{ operand: packPath }], [packPath], true);
    compare('index-pack', [['--verify'], { operand: packPath }], ['--verify', packPath], true);
    compare('index-pack', [['--fix-thin'], { operand: packPath }], ['--fix-thin', packPath], false);
    compare('index-pack', [['--stdin'], ['--fix-thin']], ['--stdin', '--fix-thin'], true, pack);
    compare('index-pack', [['--stdin'], ['--verify']], ['--stdin', '--verify'], false);
    compare(
      'index-pack',
      [['--progress-title', 'one'], ['--progress-title', 'two'], { operand: packPath }],
      ['--progress-title', 'one', '--progress-title', 'two', packPath],
      false,
    );
    compare(
      'index-pack',
      [['-o', join(root, 'out.idx')], ['-o', join(root, 'out.idx')], { operand: packPath }],
      ['-o', join(root, 'out.idx'), '-o', join(root, 'out.idx'), packPath],
      false,
    );
  });
  it.skipIf(!native247)('rejects explicit object format with stdin', () => {
    compare(
      'index-pack',
      [['--stdin'], ['--object-format', 'sha1']],
      ['--stdin', '--object-format=sha1'],
      false,
    );
    expect(() => commandArguments('index-pack', [['--stdin']], false)).toThrow(GitArgumentError);
  });
  it('unpacks isolated binary input and rejects positional arguments', () => {
    compare('unpack-objects', [['-n'], ['--strict']], ['-n', '--strict'], true, pack);
    compare('unpack-objects', [{ operand: packPath }], [packPath], false);
    compare('unpack-objects', [['--']], ['--'], false);
  });
  it.skipIf(!native247)(
    'requires obsolete-command acknowledgement and preserves ignored all-mode operands',
    () => {
      expect(direct(['index-pack', '--stdin'], pack).status).toBe(0);
      compare('pack-redundant', [['--all']], ['--all'], false);
      compare('pack-redundant', [['--i-still-use-this']], ['--i-still-use-this'], false);
      compare(
        'pack-redundant',
        [['--i-still-use-this'], ['--all']],
        ['--i-still-use-this', '--all'],
        true,
      );
      compare(
        'pack-redundant',
        [['--i-still-use-this'], ['--all'], { operand: 'ignored' }],
        ['--i-still-use-this', '--all', 'ignored'],
        true,
      );
    },
  );
});
