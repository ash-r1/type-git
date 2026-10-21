import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';

type Format = 'sha1' | 'sha256';
type Kind = 'commit' | 'tag';
type Mode = 'abort-if-invalid' | 'strip-if-invalid' | 'sign-if-invalid' | 'sign-a' | 'sign-b';
interface Result {
  exitCode: number;
  stdout: string;
  stderr: string;
}
interface SignedObject {
  oid: string;
  body: string;
  verify: Result;
}
interface Source {
  object: SignedObject;
  commitBody: string;
}
const formats: Format[] = ['sha1', 'sha256'];
const kinds: Kind[] = ['commit', 'tag'];
const modes: Mode[] = [
  'abort-if-invalid',
  'strip-if-invalid',
  'sign-if-invalid',
  'sign-a',
  'sign-b',
];
const cases = formats.flatMap((format) =>
  kinds.flatMap((kind) =>
    [false, true].flatMap((tampered) => modes.map((mode) => ({ format, kind, tampered, mode }))),
  ),
);

/** Length-prefixed protocol payload, separate from the framing newline. */
function data(value: string): string {
  return `data ${Buffer.byteLength(value)}\n${value}\n`;
}

/** Extract the folded header without adding an extra signed-header newline. */
function signature(body: string): string {
  const lines = body.slice(0, body.indexOf('\n\n')).split('\n');
  const first = lines.findIndex((line) => /^gpgsig(?:-sha256)? /.test(line));
  expect(first).toBeGreaterThanOrEqual(0);
  const result = [lines[first].slice(lines[first].indexOf(' ') + 1)];
  for (let i = first + 1; i < lines.length && lines[i].startsWith(' '); i++) {
    result.push(lines[i].slice(1));
  }
  return result.join('\n');
}

/** Recreate the original empty-tree objects, then optionally alter only signed text. */
function stream(source: Source, format: Format, kind: Kind, tampered: boolean): string {
  const headers = source.commitBody.slice(0, source.commitBody.indexOf('\n\n')).split('\n');
  const author = headers.find((line) => line.startsWith('author '));
  const committer = headers.find((line) => line.startsWith('committer '));
  expect(author).toBeDefined();
  expect(committer).toBeDefined();
  let message = source.commitBody.slice(source.commitBody.indexOf('\n\n') + 2);
  if (kind === 'commit' && tampered) {
    message = message.replace('crypto audit', 'crypto tamper');
  }
  const commit =
    `commit refs/heads/audit\nmark :1\n${author}\n${committer}\n` +
    (kind === 'commit' ? `gpgsig ${format} ssh\n${data(signature(source.object.body))}` : '') +
    `${data(message)}\n`;
  if (kind === 'commit') {
    return `${commit}done\n`;
  }
  const body = source.object.body;
  const tagger = body.split('\n').find((line) => line.startsWith('tagger '));
  expect(tagger).toBeDefined();
  let tagMessage = body.slice(body.indexOf('\n\n') + 2);
  if (tampered) {
    tagMessage = tagMessage.replace('tag audit', 'tag tamper');
  }
  return `${commit}tag audit-tag\nfrom :1\n${tagger}\n${data(tagMessage)}done\n`;
}

/** Fingerprints bind re-sign assertions to the generated public keys. */
function fingerprint(text: string): string {
  const match = /SHA256:[A-Za-z0-9+/]+/.exec(text);
  expect(match).not.toBeNull();
  return match?.[0] ?? '';
}

describe('fast-import real SSH signatures', () => {
  let root: string;
  let env: NodeJS.ProcessEnv;
  let keyA: string;
  let keyB: string;
  let allowed: string;
  let signerA: string;
  let signerB: string;
  let unavailable: string | undefined;
  const sources = new Map<string, Source>();
  const unsupported = new Map<string, string>();

  /** Execute an independent native command and reject spawn failures or signals. */
  function run(binary: string, cwd: string, args: string[], input?: string): Result {
    const result = spawnSync(binary, args, { cwd, env, input, encoding: 'utf8', timeout: 15000 });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).not.toBeNull();
    return { exitCode: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
  }
  /** Require successful fixture setup while retaining the native diagnostic. */
  function git(cwd: string, args: string[], input?: string): string {
    const result = run('git', cwd, args, input);
    expect(result.exitCode, result.stderr).toBe(0);
    return result.stdout;
  }
  /** Configure isolated SHA-1/SHA-256 imports with two explicitly trusted SSH keys. */
  async function repository(dir: string, format: Format, key: string): Promise<void> {
    await mkdir(dir);
    git(dir, ['init', '-q', `--object-format=${format}`]);
    for (const [name, value] of [
      ['gpg.format', 'ssh'],
      ['user.signingkey', key],
      ['gpg.ssh.allowedSignersFile', allowed],
    ]) {
      git(dir, ['config', name, value]);
    }
  }
  /** Read the published object and independently verify its resulting signature. */
  function object(dir: string, kind: Kind): SignedObject {
    const ref = kind === 'tag' ? 'refs/tags/audit-tag' : 'refs/heads/audit';
    return {
      oid: git(dir, ['rev-parse', '--verify', ref]).trim(),
      body: git(dir, ['cat-file', '-p', ref]),
      verify: run('git', dir, [kind === 'tag' ? 'verify-tag' : 'verify-commit', ref]),
    };
  }

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-real-ssh-'));
    env = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'missing'),
      LC_ALL: 'C',
      GIT_AUTHOR_NAME: 'Audit',
      GIT_AUTHOR_EMAIL: 'audit@example.invalid',
      GIT_COMMITTER_NAME: 'Audit',
      GIT_COMMITTER_EMAIL: 'audit@example.invalid',
      GIT_AUTHOR_DATE: '1000000000 +0000',
      GIT_COMMITTER_DATE: '1000000000 +0000',
    };
    git(root, ['init', '-q']);
    for (const flag of ['--signed-commits', '--signed-tags']) {
      const probe = run('git', root, ['fast-import', '--quiet', `${flag}=verbatim`], '');
      if (probe.exitCode === 128 && probe.stderr.includes(`unknown option ${flag}=verbatim`)) {
        unsupported.set(flag, `Selected Git does not implement ${flag}`);
        continue;
      }
      expect(probe.exitCode, probe.stderr).toBe(0);
    }
    if (unsupported.size === 2) {
      return;
    }
    // Detect a missing external tool explicitly; signing/verification failures otherwise fail.
    const ssh = spawnSync('ssh-keygen', ['-l', '-f', join(root, 'missing')], {
      env,
      encoding: 'utf8',
      timeout: 15000,
    });
    if (ssh.error && 'code' in ssh.error && ssh.error.code === 'ENOENT') {
      unavailable = 'ssh-keygen is not installed';
      return;
    }
    expect(ssh.error).toBeUndefined();
    keyA = join(root, 'signer-a');
    keyB = join(root, 'signer-b');
    allowed = join(root, 'allowed-signers');
    for (const key of [keyA, keyB]) {
      const generated = run('ssh-keygen', root, ['-q', '-t', 'ed25519', '-N', '', '-f', key]);
      expect(generated.exitCode, generated.stderr).toBe(0);
    }
    signerA = fingerprint(
      run('ssh-keygen', root, ['-l', '-E', 'sha256', '-f', `${keyA}.pub`]).stdout,
    );
    signerB = fingerprint(
      run('ssh-keygen', root, ['-l', '-E', 'sha256', '-f', `${keyB}.pub`]).stdout,
    );
    expect(signerA).not.toBe(signerB);
    await writeFile(
      allowed,
      (await Promise.all([keyA, keyB].map((key) => readFile(`${key}.pub`, 'utf8'))))
        .map((pub) => `audit@example.invalid ${pub}`)
        .join(''),
    );
    for (const format of formats) {
      for (const kind of kinds) {
        if (unsupported.has(kind === 'tag' ? '--signed-tags' : '--signed-commits')) {
          continue;
        }
        const dir = join(root, `source-${format}-${kind}`);
        await repository(dir, format, keyA);
        git(dir, [
          'commit',
          '-q',
          '--allow-empty',
          ...(kind === 'commit' ? ['-S'] : []),
          '-m',
          'crypto audit',
        ]);
        git(dir, ['branch', '-m', 'audit']);
        if (kind === 'tag') {
          git(dir, ['tag', '-s', 'audit-tag', '-m', 'tag audit']);
        }
        const signed = object(dir, kind);
        expect(signed.verify.exitCode, signed.verify.stderr).toBe(0);
        expect(fingerprint(signed.verify.stderr)).toBe(signerA);
        sources.set(`${format}-${kind}`, {
          object: signed,
          commitBody: git(dir, ['cat-file', '-p', 'HEAD']),
        });
      }
    }
  }, 30000);

  afterAll(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.for(cases)(
    '$format $kind tampered=$tampered $mode',
    async (item, context) => {
      if (unavailable) {
        context.skip(unavailable);
        return;
      }
      const { format, kind, tampered, mode } = item;
      const flag = kind === 'tag' ? '--signed-tags' : '--signed-commits';
      const value =
        mode === 'sign-a'
          ? `sign-if-invalid=${keyA}`
          : mode === 'sign-b'
            ? `sign-if-invalid=${keyB}`
            : mode;
      const capability = `${format}:${flag}=${value}`;
      const reason = unsupported.get(flag) ?? unsupported.get(capability);
      if (reason) {
        context.skip(reason);
        return;
      }
      const source = sources.get(`${format}-${kind}`);
      expect(source).toBeDefined();
      if (!source) {
        return;
      }
      const caseDir = await mkdtemp(join(root, 'case-'));
      const nativeDir = join(caseDir, 'native');
      const actualDir = join(caseDir, 'actual');
      try {
        for (const dir of [nativeDir, actualDir]) {
          await repository(dir, format, keyB);
        }
        const stdin = stream(source, format, kind, tampered);
        const native = run('git', nativeDir, ['fast-import', '--quiet', `${flag}=${value}`], stdin);
        // Some callbacks parse a mode but reject it only when a signed object is
        // reached. Probe the complete native stream, not just empty stdin/verbatim.
        // Match only the source-backed unsupported-mode diagnostics; verification,
        // signing, spawn and other operational failures must still fail the test.
        const unknownMode =
          native.exitCode === 129 &&
          native.stderr
            .replaceAll('\r\n', '\n')
            .startsWith(`usage: unknown ${flag} mode '${value}'\n`);
        // Object-processing diagnostics name the mode without its optional key ID.
        const modeName = value.split('=', 1)[0];
        const rejectedSignedObject =
          native.exitCode === 128 &&
          native.stderr.includes(
            `fatal: '${modeName}' is not a valid mode for git fast-import with ${flag}=<mode>`,
          );
        if (unknownMode || rejectedSignedObject) {
          const detectedReason = `Selected Git does not implement ${capability}`;
          unsupported.set(capability, detectedReason);
          context.skip(detectedReason);
          return;
        }
        const repo = await new TypeGit({ inheritEnv: false, env }).open(actualDir);
        const actual = await repo.command('fast-import', [['--quiet'], [flag, value]] as never, {
          stdin,
        });
        expect(actual.exitCode).toBe(native.exitCode);
        expect(actual.stdout).toBe(native.stdout);
        // Preserve all other diagnostics; only the crash-report PID varies between executions.
        const normalize = (text: string) =>
          text.replace(/fast_import_crash_\d+/g, 'fast_import_crash_PID');
        expect(normalize(actual.stderr)).toBe(normalize(native.stderr));
        if (tampered && mode === 'abort-if-invalid') {
          expect(native.exitCode).toBe(128);
          expect(native.stderr).toContain('aborting due to invalid signature');
          return;
        }
        expect(native.exitCode, native.stderr).toBe(0);
        const nativeObject = object(nativeDir, kind);
        expect(object(actualDir, kind)).toEqual(nativeObject);
        if (tampered && mode === 'strip-if-invalid') {
          expect(nativeObject.body).not.toContain('-----BEGIN SSH SIGNATURE-----');
          expect(nativeObject.verify.exitCode).not.toBe(0);
        } else {
          expect(nativeObject.verify.exitCode, nativeObject.verify.stderr).toBe(0);
          expect(fingerprint(nativeObject.verify.stderr)).toBe(
            !tampered || mode === 'sign-a' ? signerA : signerB,
          );
          if (!tampered) {
            expect(nativeObject.oid).toBe(source.object.oid);
          }
        }
      } finally {
        await rm(caseDir, { recursive: true, force: true });
      }
    },
    30000,
  );
});
