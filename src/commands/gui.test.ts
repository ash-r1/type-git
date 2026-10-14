import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { guiGrammarFromSource, guiLaunchFromSource } from './gui-syntax.js';

const nativeEnv: NodeJS.ProcessEnv = { ...process.env, LC_ALL: 'C' };
const shellPrelude: Record<'gui' | 'citool', boolean> = { gui: true, citool: true };
const versionAvailable = (command: 'gui' | 'citool'): boolean => {
  const location = spawnSync('git', ['--exec-path'], {
    env: nativeEnv,
    input: '',
    encoding: 'utf8',
    timeout: 10000,
  });
  expect(location.error).toBeUndefined();
  expect(location.signal).toBeNull();
  expect(location.status).toBe(0);
  try {
    const script = readFileSync(
      join(location.stdout.replace(/\r?\n$/, ''), `git-${command}`),
      'utf8',
    );
    if (guiLaunchFromSource(script) === 'direct-tcl') {
      shellPrelude[command] = false;
      console.warn(
        `Skipping ${command} shell-version comparisons: verified direct-Tcl launcher has no shell prelude.`,
      );
      return true;
    }
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }
  const result = spawnSync('git', [command, '--version'], {
    env: nativeEnv,
    input: '',
    encoding: 'utf8',
    timeout: 10000,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status).not.toBeNull();
  if ((result.stdout + result.stderr).includes(`git: '${command}' is not a git command`)) {
    expect(result.status).toBe(1);
    console.warn(`Skipping native ${command} checks: selected Git does not install this frontend.`);
    return false;
  }
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('git-gui version');
  return true;
};
const available: Record<'gui' | 'citool', boolean> = {
  gui: versionAvailable('gui'),
  citool: versionAvailable('citool'),
};
const toolkitAvailable = (): boolean => {
  if (!(process.env.DISPLAY && (available.gui || available.citool))) {
    return false;
  }
  const result = spawnSync('wish', [], {
    env: nativeEnv,
    encoding: 'utf8',
    timeout: 10000,
    input:
      'if {[catch {package require Tk; package require msgcat} message]} {puts stderr $message; exit 1}\nputs TYPE_GIT_TK_READY\nexit 0\n',
  });
  if (result.error && 'code' in result.error && result.error.code === 'ENOENT') {
    console.warn('Skipping native X11 checks: the wish interpreter is not installed.');
    return false;
  }
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status).not.toBeNull();
  if (/can't find package (?:Tk|msgcat)/.test(result.stderr)) {
    expect(result.status).not.toBe(0);
    console.warn(`Skipping native X11 checks: ${result.stderr.trim()}`);
    return false;
  }
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('TYPE_GIT_TK_READY');
  return true;
};
const x11Available: boolean = toolkitAvailable();
describe('GUI operation grammar', () => {
  it('identifies the actual selected GUI source independently of Git version', async ({ skip }) => {
    if (!available.gui) {
      skip();
      return;
    }
    const probe = spawnSync('git', ['--exec-path'], {
      env: nativeEnv,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(probe.error).toBeUndefined();
    expect(probe.signal).toBeNull();
    expect(probe.status).toBe(0);
    let source: string;
    try {
      source = await readFile(join(probe.stdout.replace(/\r?\n$/, ''), 'git-gui'), 'utf8');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        console.warn(
          'Skipping GUI source fingerprint check: selected frontend has no readable script at exec-path.',
        );
        skip();
        return;
      }
      throw error;
    }
    if (guiLaunchFromSource(source) === 'direct-tcl') {
      console.warn(
        'Verified direct-Tcl launcher; version execution is not a shell-prelude comparison.',
      );
      return;
    }
    const profile = guiGrammarFromSource(source);
    const version = spawnSync('git', ['gui', '--version'], {
      env: nativeEnv,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(version.error).toBeUndefined();
    expect(version.signal).toBeNull();
    expect(version.status).toBe(0);
    if (profile !== undefined && version.stdout.includes('0.21.0.53.g0d211')) {
      expect(profile).toBe('path-loop');
    }
    if (profile !== undefined && version.stdout.includes('0.21.0.278.g1b2c2a')) {
      expect(profile).toBe('positional');
    }
    console.warn(
      `Selected GUI parser profile: ${profile ?? 'unknown; native validation deferred'}`,
    );
  });

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
      commandArguments(
        'gui browser',
        [['--'], { operand: 'HEAD' }, { operand: 'src' }],
        true,
        undefined,
        'positional',
      ),
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
    expect(commandArguments('gui blame', [['--line', 2]], true, undefined, 'positional')).toEqual([
      'gui',
      'blame',
      '--line=2',
    ]);
    expect(commandArguments('gui blame', [{ operand: '--line=2' }], true)).toEqual([
      'gui',
      'blame',
      '--line=2',
    ]);
    for (const args of [
      [{ operand: 'HEAD' }, ['--line', 2], { operand: 'file' }],
      [['--line', 1], ['--line', 2], { operand: 'file' }],
    ]) {
      expect(() => commandArguments('gui blame', args, true, undefined, 'positional')).toThrow(
        GitArgumentError,
      );
    }
  });
  for (const command of ['gui', 'citool'] as const) {
    it(`matches the ${command} version shell prelude without a display`, ({ skip }) => {
      if (!(available[command] && shellPrelude[command])) {
        skip();
        return;
      }
      for (const args of [[['--version']], [{ operand: 'version' }]]) {
        const argv = commandArguments(command, args, true);
        const result = spawnSync('git', argv, {
          env: nativeEnv,
          input: '',
          encoding: 'utf8',
          timeout: 10000,
        });
        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain('git-gui version');
      }
      expect(() => commandArguments(command, [['--trace'], ['--version']], true)).toThrow(
        GitArgumentError,
      );
    });
  }
  it.skipIf(!x11Available)(
    'matches native X11 argument failures in a disposable repository',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'type-git-gui-'));
      const env = {
        ...nativeEnv,
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_GLOBAL: join(root, 'global'),
        GIT_CONFIG_NOSYSTEM: '1',
      };
      try {
        const initialized = spawnSync('git', ['init', root], {
          env,
          input: '',
          encoding: 'utf8',
          timeout: 10000,
        });
        expect(initialized.error).toBeUndefined();
        expect(initialized.signal).toBeNull();
        expect(initialized.status, initialized.stderr).toBe(0);
        const committed = spawnSync(
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
          { env, input: '', encoding: 'utf8', timeout: 10000 },
        );
        expect(committed.error).toBeUndefined();
        expect(committed.signal).toBeNull();
        expect(committed.status, committed.stderr).toBe(0);
        for (const words of [
          ['gui', 'browser'],
          ['gui', 'blame'],
          ['gui', 'gui', 'extra'],
          ['citool', 'extra'],
          ['gui', '--trace', '--version'],
          ['gui', 'version', 'extra'],
          ['citool', 'version', 'extra'],
        ]) {
          if (!available[words[0] as 'gui' | 'citool']) {
            continue;
          }
          const result = spawnSync('git', ['-C', root, ...words], {
            env,
            input: '',
            encoding: 'utf8',
            timeout: 10000,
          });
          const label = `${words.join(' ')}: ${result.stderr}`;
          expect(result.error, label).toBeUndefined();
          expect(result.signal, label).toBeNull();
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
