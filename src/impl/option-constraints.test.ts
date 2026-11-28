import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { COMMAND_CONSTRAINTS } from '../constraints/commands.js';
import { assignments } from '../constraints/explore.js';
import { INPUT_CONSTRAINTS } from '../constraints/inputs.js';
import { violations } from '../constraints/model.js';
import type { CloneOpts, Git } from '../core/git.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { createGitSync } from './git-impl.js';

const supportsSubmoduleFilter = spawnSync('git', ['clone', '-h'], {
  encoding: 'utf8',
}).stdout.includes('also-filter-submodules');
// The rebase backend comparison runs every option the audit covers, the newest being
// --update-refs (Git 2.38); older Git refuses it as unknown, which is not the rule under test.
const supportsRebaseUpdateRefs = spawnSync('git', ['rebase', '-h'], {
  encoding: 'utf8',
}).stdout.includes('update-refs');
// Git that knows --empty but not its stop value (for example 2.43) refuses the value in the option
// callback (exit 128); Git without --empty (2.25) reports an unknown option. Both happen before a
// later -h, so only a release that accepts --empty=stop reaches the plain usage exit.
const emptyStopProbe = spawnSync('git', ['rebase', '--empty=stop', '-h'], { encoding: 'utf8' });
const supportsRebaseEmptyStop = emptyStopProbe.status === 129 && emptyStopProbe.stderr === '';

describe('option constraints against independent Git executions', () => {
  let root: string;
  let git: Git;
  let repo: WorktreeRepo;
  let environment: NodeJS.ProcessEnv;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-options-'));
    environment = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_GLOBAL: join(root, 'empty-config'),
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      GIT_TERMINAL_PROMPT: '0',
    };
    await writeFile(join(root, 'empty-config'), '');
    git = createGitSync({
      adapters: createNodeAdapters(),
      home: root,
      inheritEnv: false,
      env: environment,
    });
    repo = await git.init(join(root, 'source'));
    await repo.raw(['symbolic-ref', 'HEAD', 'refs/heads/main']);
    await writeFile(join(repo.workdir, 'file'), 'initial\n');
    await repo.add('file');
    await repo.commit({ message: 'initial' });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function raw(args: string[]) {
    const result = spawnSync('git', args, { env: environment, encoding: 'utf8', timeout: 15000 });
    if (result.error) {
      throw result.error;
    }
    expect(result.signal).toBeNull();
    return result;
  }

  it('preserves boolean ls-tree abbreviation for worktree and bare repositories', async () => {
    const bare = await git.clone(repo.workdir, join(root, 'bare'), { bare: true });
    for (const client of [repo, bare]) {
      for (const abbrev of [true, false, 7]) {
        const entries = await client.lsTree('HEAD', { abbrev });
        expect(entries).toHaveLength(1);
        expect(entries[0]?.path).toBe('file');
      }
    }
  });

  it('compares every LFS checkout stage/destination combination with the LFS parser', async () => {
    for (const options of assignments({
      base: [false, true],
      ours: [false, true],
      theirs: [false, true],
      to: [undefined, '', 'output'],
    })) {
      const args = ['-C', repo.workdir, 'lfs', 'checkout'];
      if (options.base) {
        args.push('--base');
      }
      if (options.ours) {
        args.push('--ours');
      }
      if (options.theirs) {
        args.push('--theirs');
      }
      if (options.to !== undefined) {
        args.push(`--to=${options.to}`);
      }
      args.push('file');
      const result = raw(args);
      const optionError = /at most one of|must be used together/.test(
        result.stderr + result.stdout,
      );
      expect(optionError, `${JSON.stringify(options)}: ${result.stderr}`).toBe(
        violations(COMMAND_CONSTRAINTS.lfsCheckout, options).length > 0,
      );
      // A valid conflict invocation can still fail: this fixture has no unmerged index.
      if (!(options.base || options.ours || options.theirs || options.to)) {
        expect(result.status).toBe(0);
      }
    }
    await expect(repo.lfs.checkout('file', { ours: true } as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await repo.lfs.checkout('file', { onProgress: () => undefined });
    const result = raw(['-C', repo.workdir, 'lfs', 'checkout', '--include=*.bin']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('unknown flag');
  });

  it('checks cached LFS lock constraints without contacting a server', async () => {
    for (const options of assignments({
      cached: [true],
      local: [false, true],
      verify: [false, true],
      limit: [undefined, -1, 0, 1],
      id: [undefined, '', '1'],
    })) {
      const args = ['-C', repo.workdir, 'lfs', 'locks', '--json', '--cached'];
      if (options.local) {
        args.push('--local');
      }
      if (options.verify) {
        args.push('--verify');
      }
      if (options.limit !== undefined) {
        args.push(`--limit=${options.limit}`);
      }
      if (options.id !== undefined) {
        args.push(`--id=${options.id}`);
      }
      const result = raw(args);
      expect(result.status === 0, `${JSON.stringify(options)}: ${result.stderr}`).toBe(
        violations(COMMAND_CONSTRAINTS.lfsLocks, options).length === 0,
      );
    }
    expect(await repo.lfs.locks({ cached: true })).toEqual([]);
    expect(await repo.lfs.locks({ cached: true, verify: true })).toEqual([]);
  }, 30000);

  it('compares LFS migrate info fixup combinations, including empty filters and default pointers', async () => {
    for (const options of assignments({
      fixup: [false, true],
      include: [undefined, '', '*.bin'],
      pointers: [undefined, 'follow', 'no-follow', 'ignore'],
    })) {
      const args = ['-C', repo.workdir, 'lfs', 'migrate', 'info', '--skip-fetch'];
      if (options.fixup) {
        args.push('--fixup');
      }
      if (options.include !== undefined) {
        args.push(`--include=${options.include}`);
      }
      if (options.pointers !== undefined) {
        args.push(`--pointers=${options.pointers}`);
      }
      const result = raw(args);
      expect(result.status === 0, `${JSON.stringify(options)}: ${result.stderr}`).toBe(
        violations(COMMAND_CONSTRAINTS.lfsMigrateInfo, options).length === 0,
      );
    }
    await expect(
      repo.lfs.migrateInfo({ fixup: true, pointers: 'follow' } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    await repo.lfs.migrateInfo({ fixup: true, pointers: 'ignore', skipFetch: true });
  }, 30000);

  it('checks LFS migrate import size thresholds and no-rewrite prerequisites', async () => {
    for (const above of ['0', '0.5b', '1b', '0.001kb']) {
      const options = { above, include: '*.bin' };
      const result = raw([
        '-C',
        repo.workdir,
        'lfs',
        'migrate',
        'import',
        '--skip-fetch',
        `--above=${above}`,
        '--include=*.bin',
      ]);
      expect(/Cannot use --above/.test(result.stderr), result.stderr).toBe(
        violations(COMMAND_CONSTRAINTS.lfsMigrateImport, options).length > 0,
      );
      if (above === '0' || above === '0.5b') {
        expect(result.status, result.stderr).toBe(0);
      }
    }
    const result = raw(['-C', repo.workdir, 'lfs', 'migrate', 'import', '--no-rewrite']);
    expect(result.stderr).toContain('Expected one or more files');
    await expect(repo.lfs.migrateImport({ noRewrite: true } as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await expect(repo.lfs.migrateImport({ above: '1kb', include: '*.bin' })).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await expect(repo.lfs.migrateExport({} as never)).rejects.toBeInstanceOf(GitArgumentError);
    const missing = raw(['-C', repo.workdir, 'lfs', 'migrate', 'export', '--skip-fetch']);
    expect(missing.stderr).toContain('must be specified with --include');
  });

  it('checks all reset modes and intent-to-add states against Git', async () => {
    for (const options of assignments({
      mode: [undefined, 'soft', 'mixed', 'hard', 'merge', 'keep'],
      intentToAdd: [undefined, false, true],
    })) {
      const args = ['-C', repo.workdir, 'reset'];
      if (options.mode) {
        args.push(`--${options.mode}`);
      }
      if (options.intentToAdd) {
        args.push('-N');
      }
      args.push('HEAD');
      const result = raw(args);
      expect(result.status === 0, `${JSON.stringify(options)}: ${result.stderr}`).toBe(
        violations(COMMAND_CONSTRAINTS.reset, options).length === 0,
      );
    }
    await expect(
      repo.reset('HEAD', { mode: 'hard', intentToAdd: true } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });

  it.skipIf(!supportsRebaseUpdateRefs)(
    'checks rebase backend selections and actions against Git',
    async () => {
      await repo.raw(['checkout', '-q', '-b', 'topic']);
      await writeFile(join(repo.workdir, 'topic'), 'topic\n');
      await repo.add('topic');
      await repo.commit({ message: 'topic' });
      await repo.raw(['checkout', '-q', 'main']);
      await writeFile(join(repo.workdir, 'main'), 'main\n');
      await repo.add('main');
      await repo.commit({ message: 'main' });
      await repo.raw(['checkout', '-q', 'topic']);
      const start = (await repo.raw(['rev-parse', 'topic'])).stdout.trim();
      for (const options of assignments({
        apply: [undefined, true],
        whitespace: [undefined, 'fix'],
        root: [undefined, true],
        onto: [undefined, 'main'],
        keepBase: [undefined, true],
        reapplyCherryPicks: [undefined, true],
        ignoreWhitespace: [undefined, true],
        updateRefs: [undefined, true],
      })) {
        // A refused native run leaves nothing to undo; a successful one is undone below.
        const args = ['-C', repo.workdir, 'rebase', '-q'];
        for (const [key, flag] of [
          ['apply', '--apply'],
          ['root', '--root'],
          ['keepBase', '--keep-base'],
          ['reapplyCherryPicks', '--reapply-cherry-picks'],
          ['ignoreWhitespace', '--ignore-whitespace'],
          ['updateRefs', '--update-refs'],
        ] as const) {
          if (options[key]) {
            args.push(flag);
          }
        }
        if (options.whitespace) {
          args.push('--whitespace', options.whitespace);
        }
        if (options.onto) {
          args.push('--onto', options.onto);
        }
        if (!options.root) {
          args.push('main');
        }
        const result = raw(args);
        if (result.status === 0) {
          raw(['-C', repo.workdir, 'reset', '-q', '--hard', start]);
        }
        const opts = { ...options, quiet: true, ...(options.root ? {} : { upstream: 'main' }) };
        const refused = await repo.rebase(opts as never).then(
          () => false,
          (error) => {
            if (error instanceof GitArgumentError) {
              return true;
            }
            throw error;
          },
        );
        raw(['-C', repo.workdir, 'reset', '-q', '--hard', start]);
        expect(refused, `${JSON.stringify(options)}: ${result.stderr}`).toBe(result.status !== 0);
      }
      await expect(repo.rebase({ abort: true, quiet: true })).rejects.toBeInstanceOf(
        GitArgumentError,
      );
      // check_exec_cmd refuses a command with a newline, a blank one, and an empty one in a list.
      for (const exec of ['', 'a\nb', ' \t']) {
        await expect(repo.rebase({ upstream: 'main', exec })).rejects.toBeInstanceOf(
          GitArgumentError,
        );
      }
      await expect(
        repo.rebase({ upstream: 'main', exec: ['true', ''] } as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
      for (const exec of ['', 'a\nb', ' \t']) {
        expect(raw(['-C', repo.workdir, 'rebase', '--exec', exec, 'main']).status).not.toBe(0);
      }
      await expect(
        repo.rebase({ upstream: 'main', whitespace: 'bogus' } as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
      expect(raw(['-C', repo.workdir, 'rebase', '--whitespace', 'bogus', 'main']).status).not.toBe(
        0,
      );
    },
    180_000,
  );

  it.skipIf(!supportsRebaseEmptyStop)('passes rebase --empty=stop to Git', async () => {
    await repo.rebase({ upstream: 'main', empty: 'stop' });
  });

  it('checks show output-format and first-pass quiet combinations against Git', async () => {
    for (const options of assignments({
      stat: [undefined, false, true],
      nameOnly: [undefined, false, true],
      nameStatus: [undefined, false, true],
      quiet: [undefined, false, true],
    })) {
      // Same emission order as WorktreeRepo.show; Git parses --quiet in its first pass.
      const args = ['-C', repo.workdir, 'show'];
      if (options.stat) {
        args.push('--stat');
      }
      if (options.nameOnly) {
        args.push('--name-only');
      }
      if (options.nameStatus) {
        args.push('--name-status');
      }
      if (options.quiet) {
        args.push('--quiet');
      }
      args.push('HEAD');
      const result = raw(args);
      const accepted = violations(COMMAND_CONSTRAINTS.show, options).length === 0;
      // Newer Git lets --stat clear the first-pass --quiet; the model keeps the Git 2.25 refusal.
      const portableRefusal = Boolean(options.quiet && options.stat) && !accepted;
      expect(
        result.status === 0 ? accepted || portableRefusal : !accepted,
        `${JSON.stringify(options)}: ${result.stderr}`,
      ).toBe(true);
    }
    await expect(
      repo.show('HEAD', { nameOnly: true, nameStatus: true } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    await expect(
      repo.show('HEAD', { quiet: true, nameOnly: true } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    await expect(
      repo.show('HEAD', { quiet: true, stat: true, nameOnly: true } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    // Git releases differ on whether --stat output survives --quiet; only acceptance is portable.
    await expect(repo.show('HEAD', { quiet: true, stat: true })).resolves.toMatch(/^commit /);
  });

  it('checks add mode, dry-run and executable-bit combinations against Git', async () => {
    for (const options of assignments({
      all: [undefined, true],
      dryRun: [undefined, true],
      update: [undefined, true],
      ignoreRemoval: [undefined, true],
      ignoreMissing: [undefined, true],
      chmod: [undefined, '+x', '-x', 'x'],
    })) {
      // Same emission order as WorktreeRepo.add.
      const args = ['-C', repo.workdir, 'add'];
      if (options.all) {
        args.push('--all');
      }
      if (options.dryRun) {
        args.push('--dry-run');
      }
      if (options.update) {
        args.push('--update');
      }
      if (options.ignoreRemoval) {
        args.push('--ignore-removal');
      }
      if (options.ignoreMissing) {
        args.push('--ignore-missing');
      }
      if (options.chmod) {
        args.push(`--chmod=${options.chmod}`);
      }
      args.push('--', 'file');
      const result = raw(args);
      const rejected = violations(COMMAND_CONSTRAINTS.add, options).map((rule) => rule.id);
      // The only type-git rule rejects a combination that Git silently reinterprets as --no-all.
      expect(
        result.status === 0,
        `${JSON.stringify(options)}: ${result.stderr} ${rejected.join(',')}`,
      ).toBe(rejected.filter((id) => id !== 'add.all-ignoreRemoval').length === 0);
      // Kept independent of the rule table so that dropping the type-git rule still fails here.
      const reinterpretedAll = options.all === true && options.ignoreRemoval === true;
      expect(rejected.includes('add.all-ignoreRemoval')).toBe(reinterpretedAll);
      if (rejected.length > 0 || reinterpretedAll) {
        await expect(repo.add('file', options as never)).rejects.toBeInstanceOf(GitArgumentError);
      } else {
        // The real emission order must reach the same native acceptance.
        await expect(repo.add('file', options as never)).resolves.toBeUndefined();
      }
    }
  });

  it('checks empty pathspecs in add, rm, path checkout and restore against Git', async () => {
    // rm runs as a dry run so every case starts from the same tracked file.
    const commands = [
      { name: 'add', argv: ['add'], run: (paths: string[]) => repo.add(paths) },
      {
        name: 'rm',
        argv: ['rm', '--dry-run'],
        run: (paths: string[]) => repo.rm(paths, { dryRun: true }),
      },
      { name: 'checkout', argv: ['checkout'], run: (paths: string[]) => repo.checkout(paths) },
      { name: 'restore', argv: ['restore'], run: (paths: string[]) => repo.restore(paths) },
      {
        name: 'restore --staged',
        argv: ['restore', '--staged'],
        run: (paths: string[]) => repo.restore(paths, { staged: true }),
      },
    ];
    for (const command of commands) {
      for (const paths of [[''], ['file'], ['file', ''], ['', 'file']]) {
        const result = raw(['-C', repo.workdir, ...command.argv, '--', ...paths]);
        const rejected = violations(INPUT_CONSTRAINTS.pathspec, { paths, emptyPathspec: '' });
        const label = `${command.name} ${JSON.stringify(paths)}: ${result.stderr}`;
        // Kept independent of the rule table: Git refuses exactly the lists with an empty entry.
        expect(result.status === 0, label).toBe(!paths.includes(''));
        expect(rejected.length === 0, label).toBe(!paths.includes(''));
        if (paths.includes('')) {
          expect(result.stderr, label).toContain('empty string is not a valid pathspec');
          await expect(command.run(paths), label).rejects.toBeInstanceOf(GitArgumentError);
        } else {
          await expect(command.run(paths), label).resolves.toBeUndefined();
        }
      }
    }
    // A single string is checked like a one-element list.
    await expect(repo.add('')).rejects.toBeInstanceOf(GitArgumentError);
    await expect(repo.restore('')).rejects.toBeInstanceOf(GitArgumentError);
    await expect(repo.rm('', { dryRun: true })).rejects.toBeInstanceOf(GitArgumentError);
  });

  it('checks empty switch targets against Git', async () => {
    for (const [argv, opts] of [
      [[], undefined],
      [['-c'], { create: true }],
      [['-C'], { forceCreate: true }],
      [['--detach'], { detach: true }],
    ] as const) {
      const result = raw(['-C', repo.workdir, 'switch', ...argv, '']);
      const label = `${JSON.stringify(argv)}: ${result.stderr}`;
      // Kept independent of the rule table: Git never accepts an empty target.
      expect(result.status, label).toBe(128);
      expect(violations(INPUT_CONSTRAINTS.switchTarget, { branch: '' }), label).toHaveLength(1);
      await expect(repo.switch('', opts), label).rejects.toBeInstanceOf(GitArgumentError);
    }
    expect(violations(INPUT_CONSTRAINTS.switchTarget, { branch: 'main' })).toHaveLength(0);
    await expect(repo.switch('main')).resolves.toBeUndefined();
  });

  it('checks switch modes, tracking, start points and conflict styles against Git', async () => {
    raw(['-C', repo.workdir, 'branch', 'other']);
    raw(['-C', repo.workdir, 'config', 'remote.origin.url', repo.workdir]);
    raw([
      '-C',
      repo.workdir,
      'config',
      'remote.origin.fetch',
      '+refs/heads/*:refs/remotes/origin/*',
    ]);
    raw(['-C', repo.workdir, 'update-ref', 'refs/remotes/origin/feat', 'HEAD']);
    // Only an accepted switch changes HEAD or creates a branch.
    const reset = () => {
      raw(['-C', repo.workdir, 'switch', '-qf', 'main']);
      raw(['-C', repo.workdir, 'branch', '-qD', 'neu', 'feat']);
    };
    for (const options of assignments({
      create: [undefined, true],
      forceCreate: [undefined, true],
      orphan: [undefined, true],
      detach: [undefined, true],
      track: [undefined, true],
      conflict: [undefined, 'diff3'],
      force: [undefined, true],
      startPoint: [undefined, 'main'],
    })) {
      const creates = options.create || options.forceCreate || options.orphan;
      // Without a creation mode, --track derives the new branch name from a slashed target; a
      // plain switch to a remote-tracking branch is refused from repository state instead.
      const targets = creates
        ? ['neu']
        : options.track || options.detach
          ? ['other', 'origin/feat']
          : ['other'];
      for (const target of targets) {
        // Independent of WorktreeRepo.switch: options first, then the target as the value of
        // -c/-C/--orphan or as the first operand, then the start point.
        const args = ['-C', repo.workdir, 'switch'];
        if (options.detach) {
          args.push('--detach');
        }
        if (options.track) {
          args.push('--track');
        }
        if (options.conflict) {
          args.push(`--conflict=${options.conflict}`);
        }
        if (options.force) {
          args.push('--force');
        }
        if (options.create) {
          args.push('-c');
        }
        if (options.forceCreate) {
          args.push('-C');
        }
        if (options.orphan) {
          args.push('--orphan');
        }
        args.push(target);
        if (options.startPoint) {
          args.push(options.startPoint);
        }
        const result = raw(args);
        const rejected = [
          ...violations(COMMAND_CONSTRAINTS.switch, options),
          ...violations(INPUT_CONSTRAINTS.switchTarget, { ...options, branch: target }),
        ].map((rule) => rule.id);
        const label = `${JSON.stringify(args.slice(3))}: ${result.stderr} ${rejected.join(',')}`;
        expect(result.status === 0, label).toBe(rejected.length === 0);
        if (rejected.length > 0) {
          await expect(repo.switch(target, options as never), label).rejects.toBeInstanceOf(
            GitArgumentError,
          );
        } else {
          reset();
          await expect(repo.switch(target, options as never), label).resolves.toBeUndefined();
          reset();
        }
      }
    }
  }, 30000);

  it('checks new switch branch names, including the --track derived name, against Git', async () => {
    raw(['-C', repo.workdir, 'config', 'remote.origin.url', repo.workdir]);
    raw([
      '-C',
      repo.workdir,
      'config',
      'remote.origin.fetch',
      '+refs/heads/*:refs/remotes/origin/*',
    ]);
    raw(['-C', repo.workdir, 'update-ref', 'refs/remotes/origin/feat', 'HEAD']);
    raw([
      '-C',
      repo.workdir,
      'symbolic-ref',
      'refs/remotes/origin/HEAD',
      'refs/remotes/origin/feat',
    ]);
    const reset = () => {
      raw(['-C', repo.workdir, 'switch', '-qf', 'main']);
      raw(['-C', repo.workdir, 'branch', '-qD', 'ok/x', 'feat']);
    };
    raw(['-C', repo.workdir, 'branch', 'side']);
    const cases: [string, Record<string, unknown>, string[]][] = [];
    for (const name of ['ok/x', 'a..b', 'HEAD', 'a.lock', 'x~1']) {
      cases.push([name, { create: true }, ['-c', name]]);
      cases.push([name, { forceCreate: true }, ['-C', name]]);
      cases.push([name, { orphan: true }, ['--orphan', name]]);
    }
    for (const start of ['origin/HEAD', 'origin/feat']) {
      cases.push([start, { track: true }, ['--track', start]]);
    }
    // An empty startPoint is not emitted, so it needs no creation mode.
    cases.push(['side', { startPoint: '' }, ['side']]);
    cases.push(['ok/x', { orphan: true, startPoint: '' }, ['--orphan', 'ok/x']]);
    for (const [target, options, argv] of cases) {
      reset();
      const result = raw(['-C', repo.workdir, 'switch', ...argv]);
      const label = `${JSON.stringify(argv)}: ${result.stderr}`;
      reset();
      if (result.status === 0) {
        await expect(repo.switch(target, options as never), label).resolves.toBeUndefined();
      } else {
        expect(result.stderr, label).toMatch(/is not a valid branch name/);
        await expect(repo.switch(target, options as never), label).rejects.toBeInstanceOf(
          GitArgumentError,
        );
      }
    }
    reset();
  });

  it('checks restore stage, merge, unmerged, source and path requirements against Git', async () => {
    const pathsFile = join(root, 'restore-paths');
    await writeFile(pathsFile, 'file\n');
    // Older Git (for example 2.25) checks out --ours/--theirs/--merge/--conflict paths from a
    // --source tree without refusing; the model keeps the current refusal, so on such Git only the
    // source rules may reject what Git accepts.
    const sourceStageProbe = raw([
      '-C',
      repo.workdir,
      'restore',
      '--source=HEAD',
      '--ours',
      '--',
      'file',
    ]);
    const refusesSourceStage = sourceStageProbe.status === 128;
    const SOURCE_STAGE_RULES = new Set([
      'restore.source-ours',
      'restore.source-theirs',
      'restore.source-merge',
      'restore.source-conflict',
    ]);
    for (const options of assignments({
      staged: [undefined, true],
      source: [undefined, 'HEAD', ''],
      ours: [undefined, true],
      merge: [undefined, true],
      conflict: [undefined, 'merge'],
      ignoreUnmerged: [undefined, true],
      pathspecFromFile: [undefined, pathsFile],
    })) {
      for (const paths of options.pathspecFromFile ? [[]] : [[], ['file']]) {
        const args = ['-C', repo.workdir, 'restore'];
        if (options.staged) {
          args.push('--staged');
        }
        if (options.source !== undefined) {
          args.push(`--source=${options.source}`);
        }
        if (options.ours) {
          args.push('--ours');
        }
        if (options.ignoreUnmerged) {
          args.push('--ignore-unmerged');
        }
        if (options.merge) {
          args.push('--merge');
        }
        if (options.conflict) {
          args.push(`--conflict=${options.conflict}`);
        }
        if (options.pathspecFromFile) {
          args.push(`--pathspec-from-file=${options.pathspecFromFile}`);
        }
        args.push('--', ...paths);
        const result = raw(args);
        const rejected = [
          ...violations(COMMAND_CONSTRAINTS.restore, options),
          ...violations(INPUT_CONSTRAINTS.restorePaths, { ...options, paths }),
        ].map((rule) => rule.id);
        const label = `${JSON.stringify(args.slice(3))}: ${result.stderr} ${rejected.join(',')}`;
        // Argument refusals die (128); stage lookups on a clean index are per-path errors (1).
        const legacyAccepted =
          !refusesSourceStage &&
          rejected.length > 0 &&
          rejected.every((id) => SOURCE_STAGE_RULES.has(id));
        if (!legacyAccepted) {
          expect(result.status === 128, label).toBe(rejected.length > 0);
        }
        if (rejected.length === 0 && result.status !== 0) {
          // The only accepted failure: --ours or --merge finds no stage entry for the clean path.
          expect(result.status, label).toBe(1);
          expect(Boolean(options.ours || options.merge || options.conflict), label).toBe(true);
          expect(result.stderr, label).toMatch(
            /^error: path 'file' does not have (our version|all necessary versions)$/m,
          );
        }
        if (rejected.length > 0) {
          await expect(repo.restore(paths, options as never), label).rejects.toBeInstanceOf(
            GitArgumentError,
          );
        }
      }
    }
  });

  it('treats an empty pathspec file option as omitted, as the convenience APIs emit it', async () => {
    const run = vi.spyOn(
      (repo as unknown as { runner: { runOrThrow: (...args: unknown[]) => unknown } }).runner,
      'runOrThrow',
    );
    await expect(
      repo.restore(['file'], { pathspecFromFile: '' } as never),
    ).resolves.toBeUndefined();
    expect(run.mock.calls.at(-1)?.[1]).toEqual(['restore', '--', 'file']);
    await expect(repo.add(['file'], { pathspecFromFile: '' } as never)).resolves.toBeUndefined();
    expect(run.mock.calls.at(-1)?.[1]).toEqual(['add', '--', 'file']);
    run.mockRestore();
    // A non-empty pathspec file still replaces command-line paths.
    await expect(
      repo.restore(['file'], { pathspecFromFile: 'paths' } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });

  it('checks stash staged, untracked, all, file and explicit path combinations against Git', async () => {
    const file = join(root, 'paths');
    await writeFile(file, 'file\n');
    const help = raw(['-C', repo.workdir, 'stash', 'push', '-h']);
    const supportsStaged = (help.stdout + help.stderr).includes('--staged');
    for (const options of assignments({
      staged: supportsStaged ? [undefined, false, true] : [undefined, false],
      includeUntracked: [undefined, false, true],
      all: [undefined, false, true],
      pathspecFromFile: (help.stdout + help.stderr).includes('--pathspec-from-file')
        ? [undefined, file]
        : [undefined],
      paths: [undefined, [], ['file']],
    })) {
      const args = ['-C', repo.workdir, 'stash', 'push'];
      if (options.staged) {
        args.push('--staged');
      }
      if (options.includeUntracked) {
        args.push('--include-untracked');
      }
      if (options.all) {
        args.push('--all');
      }
      if (options.pathspecFromFile) {
        args.push(`--pathspec-from-file=${file}`);
      }
      if (Array.isArray(options.paths) && options.paths.length > 0) {
        args.push('--', ...options.paths);
      }
      const result = raw(args);
      expect(result.status === 0, `${JSON.stringify(options)}: ${result.stderr}`).toBe(
        violations(COMMAND_CONSTRAINTS.stashPush, options).length === 0,
      );
    }
    await expect(repo.stash.push({ staged: true, all: true } as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
  }, 30000);

  it('checks remote mirror modes and branch tracking against Git', async () => {
    let index = 0;
    for (const options of assignments({
      mirror: [undefined, 'fetch', 'push'],
      track: [undefined, 'main'],
    })) {
      const args = ['-C', repo.workdir, 'remote', 'add'];
      if (options.mirror) {
        args.push(`--mirror=${options.mirror}`);
      }
      if (options.track) {
        args.push('-t', String(options.track));
      }
      args.push(`remote-${index++}`, repo.workdir);
      const result = raw(args);
      expect(result.status === 0, result.stderr).toBe(
        violations(COMMAND_CONSTRAINTS.remoteAdd, options).length === 0,
      );
    }
    await expect(
      repo.remote.add('invalid', repo.workdir, { mirror: 'push', track: 'main' } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });

  it.runIf(supportsSubmoduleFilter)(
    'accepts successive submodule strategies and requires init for filtering',
    async () => {
      const result = raw([
        '-C',
        repo.workdir,
        'submodule',
        'update',
        '--checkout',
        '--merge',
        '--rebase',
      ]);
      expect(result.status, result.stderr).toBe(0);
      await repo.submodule.update({ checkout: true, merge: true, rebase: true });
      const bad = raw(['-C', repo.workdir, 'submodule', 'update', '--filter=blob:none']);
      expect(bad.status).not.toBe(0);
      await expect(repo.submodule.update({ filter: 'blob:none' } as never)).rejects.toBeInstanceOf(
        GitArgumentError,
      );
      await repo.submodule.update({ init: true, filter: 'blob:none' });
    },
  );

  it('checks tag message sources and forwards empty messages', async () => {
    const file = join(root, 'message');
    await writeFile(file, 'annotation');
    const bad = raw(['-C', repo.workdir, 'tag', '-m', '', '-F', file, 'invalid']);
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toMatch(/cannot be used together|only one -F or -m option/);
    await expect(repo.tag.create('invalid', { message: '', file } as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await repo.tag.create('empty-message', { message: '' });
    expect((await repo.raw(['cat-file', '-t', 'empty-message'])).stdout.trim()).toBe('tag');
  });

  it('exhaustively checks clone layout combinations against Git, including successful cases', async () => {
    let index = 0;
    for (const o of assignments({
      bare: [undefined, false, true],
      mirror: [undefined, false, true],
      separateGitDir: [undefined, 'separate'],
    })) {
      const options = {
        ...o,
        ...(o.separateGitDir ? { separateGitDir: join(root, `gitdir-${index}`) } : {}),
      };
      // Hand-written CLI oracle: does not use the library argument builder or rule predicates.
      const args = ['clone'];
      if (options.bare === true) {
        args.push('--bare');
      }
      if (options.mirror === true) {
        args.push('--mirror');
      }
      if (options.separateGitDir) {
        args.push('--separate-git-dir', String(options.separateGitDir));
      }
      args.push(repo.workdir, join(root, `raw-${index}`));
      const result = raw(args);
      const rejected = violations(COMMAND_CONSTRAINTS.clone, options).length > 0;
      expect(result.status === 0, `${JSON.stringify(o)}: ${result.stderr}`).toBe(!rejected);
      const typedOptions = {
        ...options,
        ...(o.separateGitDir ? { separateGitDir: join(root, `typed-gitdir-${index}`) } : {}),
      } as CloneOpts;
      const call = git.clone(repo.workdir, join(root, `typed-${index++}`), typedOptions);
      if (rejected) {
        await expect(call).rejects.toBeInstanceOf(GitArgumentError);
      } else {
        expect((await call).kind).toBe(options.bare || options.mirror ? 'bare' : 'worktree');
      }
    }
  }, 30000);

  it.runIf(supportsSubmoduleFilter)(
    'exhaustively checks submodule filter prerequisites against Git',
    async () => {
      let index = 0;
      for (const options of assignments({
        alsoFilterSubmodules: [undefined, false, true],
        filter: [undefined, 'blob:none'],
        recurseSubmodules: [undefined, false, true],
      })) {
        const args = ['clone'];
        if (options.alsoFilterSubmodules === true) {
          args.push('--also-filter-submodules');
        }
        if (options.filter) {
          args.push('--filter', String(options.filter));
        }
        if (options.recurseSubmodules === true) {
          args.push('--recurse-submodules');
        }
        args.push(repo.workdir, join(root, `filter-raw-${index}`));
        const result = raw(args);
        const rejected = violations(COMMAND_CONSTRAINTS.clone, options).length > 0;
        expect(result.status === 0, `${JSON.stringify(options)}: ${result.stderr}`).toBe(!rejected);
        const call = git.clone(
          repo.workdir,
          join(root, `filter-typed-${index++}`),
          options as CloneOpts,
        );
        if (rejected) {
          await expect(call).rejects.toBeInstanceOf(GitArgumentError);
        } else {
          await expect(call).resolves.toHaveProperty('kind', 'worktree');
        }
      }
    },
    30000,
  );

  it('accepts locally ignored shallow combinations, zero jobs, and both address-family flags', async () => {
    const options = {
      depth: 1,
      shallowSince: '2020-01-01',
      shallowExclude: 'main',
      jobs: 0,
      ipv4: true,
      ipv6: true,
    };
    const result = raw([
      'clone',
      '--depth=1',
      '--shallow-since=2020-01-01',
      '--shallow-exclude=main',
      '--jobs=0',
      '--ipv4',
      '--ipv6',
      repo.workdir,
      join(root, 'raw-shallow'),
    ]);
    expect(result.status, result.stderr).toBe(0);
    await expect(
      git.clone(repo.workdir, join(root, 'typed-shallow'), options),
    ).resolves.toHaveProperty('kind', 'worktree');
  });

  it('preserves Git precedence for diff output, status rename controls, date aliases, and signing', async () => {
    await writeFile(join(repo.workdir, 'file'), 'changed\n');
    expect(
      await repo.diff(undefined, { nameOnly: true, patch: true, stat: true, context: 1 }),
    ).toEqual(['file']);
    expect(
      (await repo.diff(undefined, { nameStatus: true, numstat: true, patchWithStat: true })).files,
    ).toEqual([{ path: 'file', status: 'M' }]);
    expect((await repo.diff(undefined, { stat: true, numstat: true, patch: true })).raw).toContain(
      'diff --git',
    );
    const result = raw([
      '-C',
      repo.workdir,
      'log',
      '--since=2100-01-01',
      '--after=2000-01-01',
      '--format=%H',
    ]);
    expect(result.status, result.stderr).toBe(0);
    expect(
      (await repo.log({ since: '2100-01-01', after: '2000-01-01' })).map((c) => c.hash),
    ).toEqual(result.stdout.trim().split('\n'));
    expect(await repo.log({ merges: true, noMerges: true })).toEqual([]);
    await expect(repo.status({ noRenames: true, findRenames: true })).resolves.toHaveProperty(
      'entries',
    );
    expect((await repo.log({ maxCount: -1, skip: -1 })).length).toBeGreaterThan(0);
    await expect(repo.diff(undefined, { abbrev: -1, renameLimit: -1 })).resolves.toHaveProperty(
      'raw',
    );
    await expect(repo.lsTree('HEAD', { abbrev: -1 })).resolves.toHaveLength(1);
    await repo.add('file');
    await expect(
      repo.commit({ message: 'unsigned', gpgSign: true, noGpgSign: true }),
    ).resolves.toHaveProperty('hash');
    await repo.raw(['mv', 'file', 'renamed']);
    expect((await repo.status({ noRenames: true, findRenames: true })).entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'renamed', index: 'R' })]),
    );
  });

  it('refuses status ignored/untracked combinations exactly when Git does', async () => {
    const untracked = [undefined, 'no', 'normal', 'all'] as const;
    const ignored = [undefined, 'traditional', 'no', 'matching'] as const;
    for (const u of untracked) {
      for (const i of ignored) {
        const args = ['-C', repo.workdir, 'status', '--porcelain=v2', '-z'];
        if (u) {
          args.push(`--untracked-files=${u}`);
        }
        if (i) {
          args.push(`--ignored=${i}`);
        }
        const result = raw(args);
        const outcome = await repo.status({ untracked: u, ignored: i }).then(
          () => 'accepted',
          (error: unknown) => (error instanceof GitArgumentError ? 'refused' : 'failed'),
        );
        expect(outcome, `${u}/${i}: ${result.stderr}`).toBe(
          result.status === 0 ? 'accepted' : 'refused',
        );
      }
    }
  });

  it('reads a numeric status rename threshold as a percentage', async () => {
    // 3 of 10 lines survive the move, so the pair is a rename at 5% or 20% but not at 50%.
    // Git reads a bare 5 as 0.5 (50%), so only the percentage spelling separates these.
    const lines = Array.from({ length: 10 }, (_, n) => `line ${n}\n`);
    await writeFile(join(repo.workdir, 'moved'), lines.join(''));
    await repo.add('moved');
    await repo.commit({ message: 'moved' });
    await repo.raw(['mv', 'moved', 'target']);
    const replaced = Array.from({ length: 7 }, (_, n) => `other ${n}\n`);
    await writeFile(join(repo.workdir, 'target'), [...lines.slice(0, 3), ...replaced].join(''));
    await repo.add('target');
    const renamed = async (findRenames: number) =>
      (await repo.status({ findRenames })).entries.some(
        (e) => e.path === 'target' && e.index === 'R',
      );
    expect(await renamed(5)).toBe(true);
    expect(await renamed(20)).toBe(true);
    expect(await renamed(50)).toBe(false);
    expect(await renamed(100)).toBe(false);
    // Git turns a zero score into its 50% default, so 0 is refused rather than misread.
    for (const bad of [0, -1, 101, 50.5, Number.NaN]) {
      await expect(repo.status({ findRenames: bad })).rejects.toBeInstanceOf(GitArgumentError);
    }
  });

  it('passes accepted force/lease and tag combinations through to Git', async () => {
    const remote = await git.init(join(root, 'remote'), { bare: true });
    await repo.remote.add('origin', remote.gitDir);
    await repo.push({
      remote: 'origin',
      repo: remote.gitDir,
      refspec: 'main',
      force: true,
      forceWithLease: { refname: 'refs/heads/main', expect: '' },
    });
    await repo.fetch({ remote: 'origin', tags: true, noTags: true, jobs: 0, deepen: 0 });
    expect((await remote.raw(['rev-parse', 'main'])).stdout.trim()).toBe(
      (await repo.raw(['rev-parse', 'HEAD'])).stdout.trim(),
    );
  });

  it('rejects missing clone dependencies before any spawn and preserves sequencer options', async () => {
    const adapters = createNodeAdapters();
    const spy = vi.spyOn(adapters.exec, 'spawn');
    const client = createGitSync({ adapters, home: root, env: environment });
    await expect(
      client.clone(repo.workdir, join(root, 'bad'), { alsoFilterSubmodules: true } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(spy).not.toHaveBeenCalled();
    const checked = await client.open(repo.workdir);
    // A rebase action must be the only argument: Git prints usage whatever the state.
    await expect(checked.rebase({ abort: true, quiet: true })).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    // No operation is in progress: the error must come from Git, after serialization.
    await expect(
      checked.cherryPick([], { continue: true, cleanup: 'strip' }),
    ).rejects.not.toBeInstanceOf(GitArgumentError);
    await expect(
      checked.push({ remote: 'missing', force: true, forceWithLease: true }),
    ).rejects.not.toBeInstanceOf(GitArgumentError);
    expect(
      spy.mock.calls.some(
        ([{ argv }]) => argv.includes('--force') && argv.includes('--force-with-lease'),
      ),
    ).toBe(true);
    expect(
      spy.mock.calls.some(([{ argv }]) => argv.includes('rebase') && argv.includes('--abort')),
    ).toBe(false);
    expect(
      spy.mock.calls.some(
        ([{ argv }]) => argv.includes('--continue') && argv.includes('--cleanup'),
      ),
    ).toBe(true);
  });
});
