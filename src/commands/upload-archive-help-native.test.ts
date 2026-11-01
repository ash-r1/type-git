import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NodeExecAdapter, NodeFsAdapter, TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { createGitSync } from '../impl/git-impl.js';

const packetLengthHeader = /^[0-9a-f]{4}$/;
const decodeSideband = (stdout: string): { ack: boolean; flushes: number; bands: string[] } => {
  const bytes = Buffer.from(stdout, 'utf8');
  const bands: Buffer[][] = [[], [], []];
  let offset = 0;
  let ack = false;
  let flushes = 0;
  while (offset < bytes.length) {
    const header = bytes.subarray(offset, offset + 4).toString('ascii');
    expect(header).toMatch(packetLengthHeader);
    const size = Number.parseInt(header, 16);
    offset += 4;
    if (size === 0) {
      flushes++;
      continue;
    }
    expect(size).toBeGreaterThanOrEqual(4);
    expect(offset + size - 4).toBeLessThanOrEqual(bytes.length);
    const payload = bytes.subarray(offset, offset + size - 4);
    offset += size - 4;
    if (!ack) {
      expect(payload.toString('ascii')).toBe('ACK\n');
      expect(flushes).toBe(0);
      ack = true;
      continue;
    }
    expect(flushes).toBe(1);
    const band = payload[0];
    expect(band === 1 || band === 2 || band === 3).toBe(true);
    if (band === 1 || band === 2 || band === 3) {
      bands[band - 1]?.push(payload.subarray(1));
    }
  }
  expect(ack).toBe(true);
  return { ack, flushes, bands: bands.map((chunks) => Buffer.concat(chunks).toString('utf8')) };
};

describe('archive frontend sole usage and sideband protocol controls', () => {
  let root: string;
  let repo: WorktreeRepo;
  let request: string;
  let expectedArchive: string;
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
    root = await mkdtemp(join(tmpdir(), 'type-git-upload-archive-help-'));
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
    await writeFile(join(root, '--help'), 'base\n');
    expect(native(['add', '--', 'file', '--help']).status).toBe(0);
    expect(native(['commit', '-qm', 'base']).status).toBe(0);
    const packet = (line: string) =>
      `${(Buffer.byteLength(line) + 4).toString(16).padStart(4, '0')}${line}`;
    request = `${packet('argument --format=tar\n')}${packet('argument HEAD\n')}0000`;
    const archived = native(['archive', '--format=tar', 'HEAD']);
    expect(archived.status).toBe(0);
    expectedArchive = archived.stdout;
    expect(expectedArchive).toContain('base\n');
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
  ) => {
    const snapshot = () =>
      Promise.all([
        readdir(root).then((entries) => entries.sort()),
        ...['.git/index', 'file', '.git/HEAD'].map((path) => readFile(join(root, path))),
      ]);
    const before = await snapshot();
    const cwd = outside ? await mkdtemp(join(tmpdir(), 'type-git-upload-archive-outside-')) : root;
    try {
      const expected = spawnSync('git', ['-C', cwd, 'upload-archive', ...words], {
        env,
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
              home: root,
              inheritEnv: false,
              env,
            }),
          )
        : repo;
      const actual = await git.command('upload-archive', args as never, { stdin: input });
      expect(await snapshot()).toEqual(before);
      expect(actual.exitCode).toBe(expected.status);
      if (input) {
        expect(decodeSideband(actual.stdout)).toEqual(decodeSideband(expected.stdout));
      } else {
        expect(actual.stdout).toBe(expected.stdout);
      }
      expect(actual.stderr).toBe(expected.stderr);
      return expected;
    } finally {
      if (outside) {
        await rm(cwd, { recursive: true, force: true });
      }
    }
  };
  it('matches selected native canonical/tagged sole usage output', async () => {
    for (const outside of [false, true]) {
      for (const flag of ['-h', '--help-all']) {
        await compare([[flag]], [flag], '', outside);
        await compare([{ operand: flag }], [flag], '', outside);
      }
    }
  });
  it('produces actual tar output for a valid packet-line request inside and outside repositories', async () => {
    for (const outside of [false, true]) {
      const result = await compare([{ operand: root }], [root], request, outside);
      expect(result.status).toBe(0);
      expect(decodeSideband(result.stdout)).toEqual({
        ack: true,
        flushes: 2,
        bands: [expectedArchive, '', ''],
      });
    }
  });
  it('retains native malformed protocol failures', async () => {
    for (const outside of [false, true]) {
      const result = await compare([{ operand: root }], [root], '0008bad\n0000', outside);
      expect(result.status).toBe(128);
      const sideband = decodeSideband(result.stdout);
      expect(sideband.bands[1]).toContain("'argument' token or flush expected");
      expect(sideband.bands[2]).toContain('archiver died with error');
    }
  });
  it('rejects missing repository and multiword usage or documentation', async () => {
    expect(native(['upload-archive', '-h', root]).status).toBe(128);
    for (const args of [
      [],
      [['-h'], { operand: root }],
      [['--help-all'], { operand: root }],
      [{ operand: root }, ['--help']],
    ]) {
      await expect(repo.command('upload-archive', args as never)).rejects.toBeInstanceOf(
        GitArgumentError,
      );
    }
  });
});
