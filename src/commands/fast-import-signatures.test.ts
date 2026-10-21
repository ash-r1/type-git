import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';

type Format = 'sha1' | 'sha256';
type SignatureFormat = 'ssh' | 'openpgp';
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
  signer: string | null;
  payload: string;
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
function stream(
  source: Source,
  format: Format,
  kind: Kind,
  tampered: boolean,
  signatureFormat: SignatureFormat,
): string {
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
    (kind === 'commit'
      ? `gpgsig ${format} ${signatureFormat}\n${data(signature(source.object.body))}`
      : '') +
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

/** Read the cryptographically verified OpenPGP fingerprint, not a display-name assertion. */
function openPgpFingerprint(text: string): string {
  const match = /^\[GNUPG:\] VALIDSIG ([A-F0-9]+) /m.exec(text);
  expect(match).not.toBeNull();
  return match?.[1] ?? '';
}

/** Remove only signature headers/armor so independently timestamped signatures can be compared. */
function payload(body: string, kind: Kind, signatureFormat: SignatureFormat): string {
  if (kind === 'tag') {
    const marker =
      signatureFormat === 'ssh' ? '-----BEGIN SSH SIGNATURE-----' : '-----BEGIN PGP SIGNATURE-----';
    const start = body.indexOf(marker);
    return start < 0 ? body : body.slice(0, start);
  }
  const end = body.indexOf('\n\n');
  const lines = body.slice(0, end).split('\n');
  const retained: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^gpgsig(?:-sha256)? /.test(lines[i])) {
      while (i + 1 < lines.length && lines[i + 1].startsWith(' ')) {
        i++;
      }
    } else {
      retained.push(lines[i]);
    }
  }
  return retained.join('\n') + body.slice(end);
}

const signatureFormats: SignatureFormat[] = ['ssh', 'openpgp'];
describe.each(signatureFormats)('fast-import real %s signatures', (signatureFormat) => {
  let root: string;
  let env: NodeJS.ProcessEnv;
  let keyA: string;
  let keyB: string;
  let allowed: string;
  let signerA: string;
  let signerB: string;
  let unavailable: string | undefined;
  let gpgAgentStarted = false;
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
  /** Configure isolated imports with selected signature format and the requested signing key. */
  async function repository(dir: string, format: Format, key: string): Promise<void> {
    await mkdir(dir);
    git(dir, ['init', '-q', `--object-format=${format}`]);
    for (const [name, value] of [
      ['gpg.format', signatureFormat],
      ['user.signingkey', key],
      ...(signatureFormat === 'ssh'
        ? [['gpg.ssh.allowedSignersFile', allowed]]
        : [['gpg.program', 'gpg']]),
    ]) {
      git(dir, ['config', name, value]);
    }
  }
  /** Read the published object and independently verify its resulting signature. */
  function object(dir: string, kind: Kind): SignedObject {
    const ref = kind === 'tag' ? 'refs/tags/audit-tag' : 'refs/heads/audit';
    const body = git(dir, ['cat-file', '-p', ref]);
    const verify = run('git', dir, [
      kind === 'tag' ? 'verify-tag' : 'verify-commit',
      ...(signatureFormat === 'openpgp' ? ['--raw'] : []),
      ref,
    ]);
    const signer =
      verify.exitCode === 0
        ? signatureFormat === 'ssh'
          ? fingerprint(verify.stderr)
          : openPgpFingerprint(verify.stderr)
        : null;
    return {
      oid: git(dir, ['rev-parse', '--verify', ref]).trim(),
      body,
      verify,
      signer,
      payload: payload(body, kind, signatureFormat),
    };
  }

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), `type-git-real-${signatureFormat}-`));
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
    if (signatureFormat === 'ssh') {
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
    } else {
      env.GNUPGHOME = join(root, 'gnupg');
      await mkdir(env.GNUPGHOME, { mode: 0o700 });
      for (const tool of ['gpg', 'gpgconf']) {
        const probe = spawnSync(tool, ['--version'], { env, encoding: 'utf8', timeout: 15000 });
        if (probe.error && 'code' in probe.error && probe.error.code === 'ENOENT') {
          unavailable = `${tool} is not installed`;
          return;
        }
        expect(probe.error).toBeUndefined();
        expect(probe.signal).toBeNull();
        expect(probe.status, probe.stderr).toBe(0);
      }
      const home = run('gpgconf', root, ['--list-dirs', 'homedir']);
      expect(home.exitCode, home.stderr).toBe(0);
      // Named gpgconf directory queries return unescaped paths.
      let reportedHome = home.stdout.trim();
      if (process.platform === 'win32' && reportedHome.startsWith('/')) {
        // MSYS GPG treats a Node Windows path as relative; native Windows GPG
        // reports a drive path and does not need this conversion.
        const converted = run('cygpath', root, ['-u', env.GNUPGHOME]);
        expect(converted.exitCode, converted.stderr).toBe(0);
        expect(converted.stdout.trim()).not.toBe('');
        env.GNUPGHOME = converted.stdout.trim();
        const configured = run('gpgconf', root, ['--list-dirs', 'homedir']);
        expect(configured.exitCode, configured.stderr).toBe(0);
        const forNode = run('cygpath', root, ['-w', configured.stdout.trim()]);
        expect(forNode.exitCode, forNode.stderr).toBe(0);
        reportedHome = forNode.stdout.trim();
      }
      // Confirm isolation before generating keys, including if a tool ignores GNUPGHOME.
      expect(await realpath(reportedHome)).toBe(await realpath(join(root, 'gnupg')));
      const curves = run('gpg', root, ['--with-colons', '--list-config', 'curve']);
      expect(curves.exitCode, curves.stderr).toBe(0);
      const curveConfig = curves.stdout.split('\n').find((line) => line.startsWith('cfg:curve:'));
      expect(curveConfig).toBeDefined();
      const supportedCurves = curveConfig?.trim().split(':')[2]?.split(';') ?? [];
      if (!supportedCurves.includes('ed25519')) {
        unavailable = 'Selected GPG does not support Ed25519';
        return;
      }
      const keys: string[] = [];
      gpgAgentStarted = true;
      for (const label of ['A', 'B']) {
        const uid = `Audit ${label} <audit-${label.toLowerCase()}@example.invalid>`;
        const generated = run('gpg', root, [
          '--batch',
          '--pinentry-mode',
          'loopback',
          '--passphrase',
          '',
          '--quick-generate-key',
          uid,
          'ed25519',
          'sign',
          '0',
        ]);
        expect(generated.exitCode, generated.stderr).toBe(0);
        const listing = run('gpg', root, ['--batch', '--with-colons', '--list-keys', uid]);
        expect(listing.exitCode, listing.stderr).toBe(0);
        const key = listing.stdout
          .split('\n')
          .find((line) => line.startsWith('fpr:'))
          ?.split(':')[9];
        expect(key).toBeDefined();
        if (key) {
          keys.push(key);
        }
      }
      // Confirm the selected GPG wrote keys into the actual isolated Node directory.
      expect(
        (await readdir(join(root, 'gnupg', 'private-keys-v1.d'))).some((name) =>
          name.endsWith('.key'),
        ),
      ).toBe(true);
      [keyA, keyB] = keys;
      signerA = keyA;
      signerB = keyB;
      expect(signerA).not.toBe(signerB);
    }
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
        expect(signed.signer).toBe(signerA);
        sources.set(`${format}-${kind}`, {
          object: signed,
          commitBody: git(dir, ['cat-file', '-p', 'HEAD']),
        });
      }
    }
  }, 30000);

  afterAll(async () => {
    try {
      if (gpgAgentStarted) {
        const stopped = run('gpgconf', root, ['--kill', 'gpg-agent']);
        expect(stopped.exitCode, stopped.stderr).toBe(0);
      }
    } finally {
      if (root) {
        await rm(root, { recursive: true, force: true, maxRetries: 3 });
      }
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
        const stdin = stream(source, format, kind, tampered, signatureFormat);
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
        const actualObject = object(actualDir, kind);
        if (signatureFormat === 'ssh') {
          expect(actualObject).toEqual(nativeObject);
        } else {
          expect(actualObject.payload).toBe(nativeObject.payload);
          expect(actualObject.verify.exitCode).toBe(nativeObject.verify.exitCode);
          expect(actualObject.signer).toBe(nativeObject.signer);
          // GPG creation timestamps can change independently re-signed armor/OIDs.
          if (!tampered || mode === 'strip-if-invalid') {
            expect(actualObject.oid).toBe(nativeObject.oid);
            expect(actualObject.body).toBe(nativeObject.body);
          }
        }
        if (tampered && mode === 'strip-if-invalid') {
          expect(nativeObject.body).not.toContain(
            signatureFormat === 'ssh'
              ? '-----BEGIN SSH SIGNATURE-----'
              : '-----BEGIN PGP SIGNATURE-----',
          );
          expect(nativeObject.verify.exitCode).not.toBe(0);
        } else {
          expect(nativeObject.verify.exitCode, nativeObject.verify.stderr).toBe(0);
          expect(nativeObject.signer).toBe(!tampered || mode === 'sign-a' ? signerA : signerB);
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
