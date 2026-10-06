import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

describe('GUI operation grammar', () => {
  it('selects each GUI entrypoint and preserves citool prefix options', () => {
    expect(commandArguments('gui', [], true)).toEqual(['gui']);
    for (const command of ['gui gui', 'gui pick', 'gui citool', 'citool'] as const) {
      expect(commandArguments(command, [], true)).toEqual(command.split(' '));
      expect(() => commandArguments(command, [{ operand: 'extra' }], true)).toThrow(
        GitArgumentError,
      );
    }
    expect(
      commandArguments(
        'gui',
        [{ operand: 'citool' }, ['--amend'], ['--nocommit'], ['--commitmsg']],
        true,
      ),
    ).toEqual(['gui', 'citool', '--amend', '--nocommit', '--commitmsg']);
    expect(() => commandArguments('gui', [{ operand: 'unknown' }], true)).toThrow(GitArgumentError);
  });
  it('keeps browser revisions, paths and separator placement distinct', () => {
    expect(
      commandArguments('gui browser', [{ operand: 'HEAD' }, ['--'], { operand: 'src' }], true),
    ).toEqual(['gui', 'browser', 'HEAD', '--', 'src']);
    expect(() =>
      commandArguments('gui browser', [['--'], { operand: 'HEAD' }, { operand: 'src' }], true),
    ).toThrow(GitArgumentError);
    expect(() => commandArguments('gui browser', [], true)).toThrow(GitArgumentError);
    expect(commandArguments('gui browser', [{ operand: '--' }], true)).toEqual([
      'gui',
      'browser',
      '--',
    ]);
  });
  it('checks blame line selector order while allowing line-like literal filenames', () => {
    expect(
      commandArguments(
        'gui blame',
        [['--trace'], ['--line', 0], { operand: 'HEAD' }, ['--'], { operand: 'file' }],
        true,
      ),
    ).toEqual(['gui', 'blame', '--trace', '--line=0', 'HEAD', '--', 'file']);
    expect(commandArguments('gui blame', [{ operand: '--line=2' }], true)).toEqual([
      'gui',
      'blame',
      '--line=2',
    ]);
    for (const args of [
      [['--line', 1]],
      [['--line', -1], { operand: 'file' }],
      [{ operand: 'HEAD' }, ['--line', 2], { operand: 'file' }],
      [['--line', 1], ['--line', 2], { operand: 'file' }],
    ]) {
      expect(() => commandArguments('gui blame', args, true)).toThrow(GitArgumentError);
    }
  });
  it('matches the standalone version shell prelude without a display', () => {
    for (const command of ['gui', 'citool'] as const) {
      for (const args of [[['--version']], [{ operand: 'version' }]]) {
        const argv = commandArguments(command, args, true);
        const result = spawnSync('git', argv, { encoding: 'utf8', timeout: 10000 });
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain('git-gui version');
      }
      expect(() => commandArguments(command, [['--trace'], ['--version']], true)).toThrow(
        GitArgumentError,
      );
    }
  });
  it.skipIf(!process.env.DISPLAY)(
    'matches native X11 argument failures in a disposable repository',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'type-git-gui-'));
      const env = {
        ...process.env,
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_GLOBAL: join(root, 'global'),
        GIT_CONFIG_NOSYSTEM: '1',
      };
      try {
        expect(spawnSync('git', ['init', root], { env }).status).toBe(0);
        expect(
          spawnSync(
            'git',
            [
              '-C',
              root,
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
          ).status,
        ).toBe(0);
        for (const words of [
          ['gui', 'browser'],
          ['gui', 'blame'],
          ['gui', 'gui', 'extra'],
          ['citool', 'extra'],
          ['gui', 'browser', '--', 'HEAD', 'path'],
          ['gui', 'blame', 'HEAD', '--line=2', 'file'],
        ]) {
          const result = spawnSync('git', ['-C', root, ...words], {
            env,
            encoding: 'utf8',
            timeout: 10000,
          });
          expect(result.error).toBeUndefined();
          expect(result.status, result.stderr).toBe(1);
          expect(result.stderr).toContain('usage:');
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    30000,
  );
});
