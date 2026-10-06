import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

const p4Script = join(
  spawnSync('git', ['--exec-path'], { encoding: 'utf8' }).stdout.trim(),
  'git-p4',
);
// Some Git builds retain /usr/bin/python in the shebang even on Python 3-only hosts.
const p4Available =
  spawnSync('python3', [p4Script, 'branches', '--help'], { encoding: 'utf8' }).status === 0;
describe.skipIf(process.platform === 'win32' || !p4Available)(
  'Perforce frontend parsing without a Perforce connection',
  () => {
    let root: string;
    let repo: WorktreeRepo;
    let env: NodeJS.ProcessEnv;
    beforeAll(async () => {
      root = await mkdtemp(join(tmpdir(), 'type-git-p4-'));
      env = {
        ...process.env,
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: join(root, 'global'),
      };
      const bin = join(root, 'bin');
      await mkdir(bin);
      // Submit's constructor probes P4 before even parsing --help. Keep these
      // probes local and fail closed if an unexpected command is attempted.
      const shim = join(bin, 'p4');
      await writeFile(
        shim,
        `#!/usr/bin/env python3
import json, marshal, os, sys
args = sys.argv[1:]
if args[:2] == ['-r', '3']: args = args[2:]
with open(os.environ['TYPE_GIT_P4_PROBES'], 'a') as log: log.write(json.dumps(args) + '\\n')
if args == ['-G', 'login', '-s']:
    marshal.dump({'code': 'stat'} if os.environ['TYPE_GIT_P4_TEXT_KEYS'] == '1' else {b'code': b'stat'}, sys.stdout.buffer)
    sys.exit(0)
if args == ['help', 'move']: sys.exit(1)
sys.exit('Unexpected P4 command: ' + repr(args))
`,
      );
      await chmod(shim, 0o755);
      env.PATH = `${bin}:${process.env.PATH}`;
      env.TYPE_GIT_P4_PROBES = join(root, 'p4-probes');
      env.TYPE_GIT_P4_TEXT_KEYS = (await readFile(p4Script, 'utf8')).includes('key = key.decode()')
        ? '0'
        : '1';
      repo = await new TypeGit({ inheritEnv: false, env }).init(join(root, 'repo'));
      const result = spawnSync(
        'git',
        [
          '-C',
          repo.workdir,
          '-c',
          'user.name=Fixture',
          '-c',
          'user.email=fixture@example.invalid',
          'commit',
          '--allow-empty',
          '-m',
          'fixture',
        ],
        { env },
      );
      expect(result.status).toBe(0);
    });
    afterAll(async () => {
      const probes = (await readFile(join(root, 'p4-probes'), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      expect(probes.length).toBeGreaterThan(0);
      for (const probe of probes) {
        expect([
          ['-G', 'login', '-s'],
          ['help', 'move'],
        ]).toContainEqual(probe);
      }
      await rm(root, { recursive: true, force: true });
    });
    const direct = (args: string[]) =>
      spawnSync('python3', [p4Script, ...args.slice(1)], {
        cwd: repo.workdir,
        env,
        encoding: 'utf8',
        timeout: 10000,
      });

    it('dispatches every registered operation and preserves inherited options', () => {
      for (const operation of [
        'submit',
        'commit',
        'sync',
        'rebase',
        'clone',
        'branches',
        'unshelve',
      ]) {
        const argv = commandArguments('p4', [{ operand: operation }, ['--help']], true);
        const result = direct(argv);
        expect(result.error).toBeUndefined();
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain(` ${operation} `);
      }
      const argv = commandArguments(
        'p4 clone',
        [['--changes-block-size', -2], ['--max-changes', 'text'], ['--help']],
        true,
      );
      expect(direct(argv).status).toBe(0);
      expect(direct(['p4', 'branches', 'ignored', 'words']).status).toBe(0);
      expect(
        commandArguments('p4 branches', [{ operand: 'ignored' }, { operand: 'words' }], true),
      ).toEqual(['p4', 'branches', 'ignored', 'words']);
    });
    it('rejects invalid choices during parsing, before a later help flag', () => {
      const result = direct(['p4', 'submit', '--conflict', 'invalid', '--help']);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('invalid choice');
      expect(() =>
        commandArguments('p4 submit', [['--conflict', 'invalid'], ['--help']], true),
      ).toThrow(GitArgumentError);
      expect(
        direct(commandArguments('p4 commit', [['--conflict', 'skip'], ['--help']], true)).status,
      ).toBe(0);
    });
    it('checks operand counts and positive update-shelve entries before contacting Perforce', () => {
      for (const [command, words] of [
        ['p4 submit', ['one', 'two']],
        ['p4 clone', []],
        ['p4 unshelve', []],
        ['p4 unshelve', ['one', 'two']],
      ] as const) {
        expect(direct([...command.split(' '), ...words]).status).toBe(2);
        expect(() =>
          commandArguments(
            command,
            words.map((operand) => ({ operand })),
            true,
          ),
        ).toThrow(GitArgumentError);
      }
      const result = direct(['p4', 'submit', '--update-shelve', '1', '--update-shelve', '0']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('invalid changelist 0');
      expect(() =>
        commandArguments(
          'p4 submit',
          [
            ['--update-shelve', 1],
            ['--update-shelve', 0],
          ],
          true,
        ),
      ).toThrow(GitArgumentError);
      expect(
        direct(commandArguments('p4 submit', [['--update-shelve', 0], ['--help']], true)).status,
      ).toBe(0);
    });
    it('requires an explicit keep-path destination before positional destination inference', () => {
      const result = direct(['p4', 'clone', '--keep-path', '//depot/project', 'destination']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Must specify destination for --keep-path');
      expect(() =>
        commandArguments(
          'p4 clone',
          [['--keep-path'], { operand: '//depot/project' }, { operand: 'destination' }],
          true,
        ),
      ).toThrow(GitArgumentError);
      expect(
        commandArguments(
          'p4 clone',
          [['--keep-path'], ['--destination', 'destination'], { operand: '//depot/project' }],
          true,
        ),
      ).toEqual(['p4', 'clone', '--keep-path', '--destination=destination', '//depot/project']);
    });
  },
);
