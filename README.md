# type-git

Type-safe Git wrapper library with LFS support, progress tracking, and abort control for Node.js/Deno/Bun.

Typed inputs are checked against supported output contracts, with runtime validation for JavaScript callers.

**Upgrading:** [0.4.0 migration guide](docs/migrations/0.4.0.md).

**[Documentation](https://ash-r1.github.io/type-git/)** | **[API Reference](https://ash-r1.github.io/type-git/api/readme/)**

## Features

- **Type-safe API**: Full TypeScript support with proper type inference
- **Repository-context aware**: Distinguishes between repository-agnostic and repository-specific operations
- **Git LFS support**: Built-in support for Git LFS with progress tracking
- **Progress tracking**: Real-time progress events for clone, fetch, push, and LFS operations
- **Audit mode**: Track all Git command executions with start/end events and optional GIT_TRACE output
- **Abort control**: Cancel operations using AbortController
- **Cross-runtime**: Works with Node.js, Deno, and Bun
- **No cwd dependency**: Uses `git -C` for clean repository context management

## Design Philosophy

This library wraps Git CLI with a focus on:

1. **Output Contract Safety**: Parsed convenience APIs expose operations with stable stdout formats; typed CLI access returns raw output
2. **Repository Context**: Separates `Git` (non-repo operations) from `Repo` (repo operations)
3. **Worktree vs Bare**: Type-safe distinction between worktree and bare repositories
4. **Raw Escape Hatch**: Arbitrary git commands via `raw()` when needed

## Requirements

- **Node.js 20+**, Deno 2+, or Bun
- **Git 2.30.0+** (recommended)
  - Legacy mode supports Git 2.25.0+ with `useLegacyVersion: true`

### Git Version Compatibility

| Feature | Minimum Git Version |
|---------|---------------------|
| Core functionality (status, log, etc.) | 2.25.0 |
| `--show-stash` in status | 2.35.0 |
| Partial clone (`--filter`) | 2.18.0 |
| Sparse checkout (`--sparse`) | 2.25.0 |
| SHA-256 repositories | 2.29.0 |

## Installation

```bash
npm install type-git
```

## Usage

### Simple Usage (Recommended)

```typescript
// Node.js
import { TypeGit } from 'type-git/node';

// Bun
// import { TypeGit } from 'type-git/bun';

// Deno
// import { TypeGit } from 'type-git/deno';

// Create instance with Git version check (recommended)
const git = await TypeGit.create();

// Open an existing repository
const repo = await git.open('/path/to/repo');
const status = await repo.status();

// Clone a repository
const clonedRepo = await git.clone('https://github.com/user/repo.git', '/path/to/clone');

// Initialize a new repository
const newRepo = await git.init('/path/to/new-repo');
```

### Using with Older Git Versions

For environments with Git 2.25.0 - 2.29.x (e.g., Ubuntu 20.04 LTS):

```typescript
import { TypeGit } from 'type-git/node';

// Enable legacy mode for Git 2.25.0+
const git = await TypeGit.create({ useLegacyVersion: true });
```

### Typed CLI commands (`type-git/strict`)

For registered CLI operations without a parsed convenience method, import `strict` from
`type-git/strict`. It wraps a client or repository and adds a grammar-checked `command()`:

```typescript
import { strict } from 'type-git/strict';

const strictGit = strict(git);
const hash = await strictGit.command('hash-object', [['--stdin']], { stdin: 'hello' });

const strictRepo = strict(repo);
await strictRepo.command('remote add', [{ operand: 'origin' }, { operand: '/path/to/upstream' }]);
await strictRepo.status(); // every other method is still available
```

Option tuples and operand objects retain ordering and repeated flags. Literal combinations are
checked against Git's option grammar at compile time; dynamic input is validated at runtime,
including probes of the selected Git executable where its parser behavior differs between
builds. The result contains raw stdout, stderr, and exit status. See the
[API design and pinned baselines](docs/design/typed-command-api.md) and
[coverage ledger](docs/design/command-coverage.md) for the registered scopes and remaining audit
work.

The grammar catalogue is large, so it lives only in `type-git/strict`. The main entry point
(`type-git`, `type-git/node`, `type-git/bun`, `type-git/deno`) keeps `raw()`, the high-level API,
and the runtime checks against argument injection, and neither its bundle nor its type
declarations include the catalogue. For an application that only calls high-level methods such
as `repo.status()`, the bundled size is about 180 KB minified instead of about 1.6 MB.

### Advanced Usage

For more control over adapters, you can use the factory function:

```typescript
import { createGit } from 'type-git';
import { createNodeAdapters } from 'type-git/node';

const git = await createGit({
  adapters: createNodeAdapters(),
  // useLegacyVersion: true,  // For Git 2.25.0+
  // skipVersionCheck: true,  // Skip version check entirely
});
```

On Windows, pass `{ windowsHide: true }` to `TypeGit.create()` or `createNodeAdapters()` to keep
Git from opening console windows. To write your own `ExecAdapter` (for example one that only
allows specific invocations), see the [adapter contract](docs/adapters.md).

### Full Example

```typescript
import { TypeGit } from 'type-git/node';

const git = await TypeGit.create();

// Clone a repository with progress tracking
const repo = await git.clone('https://github.com/user/repo.git', '/path/to/clone', {
  onProgress: (progress) => {
    console.log(`${progress.phase}: ${progress.message}`);
  },
  onLfsProgress: (progress) => {
    console.log(`LFS ${progress.direction}: ${progress.bytesSoFar}/${progress.bytesTotal}`);
  },
});

// Use typed operations
const status = await repo.status();
const commits = await repo.log({ maxCount: 10 });

// LFS operations
await repo.lfs.pull();
const lfsStatus = await repo.lfs.status();

// Raw escape hatch when needed
const result = await repo.raw(['rev-parse', 'HEAD']);

// Send data on stdin instead of putting it in argv
const { stdout: blobId } = await repo.raw(['hash-object', '-w', '--stdin'], { stdin: 'hello' });
```

### Audit Mode

Track all Git command executions for logging, debugging, or monitoring:

```typescript
import { createGit } from 'type-git';
import { createNodeAdapters } from 'type-git/node';

const git = await createGit({
  adapters: createNodeAdapters(),
  audit: {
    // Called before and after every Git command
    onAudit: (event) => {
      if (event.type === 'start') {
        console.log(`[START] ${event.argv.join(' ')}`);
      } else {
        console.log(`[END] exit ${event.exitCode}, ${event.duration}ms`);
        // event.stdout, event.stderr also available
      }
    },
    // Optional: Capture GIT_TRACE output (automatically sets GIT_TRACE=1)
    onTrace: (trace) => {
      console.log(`[TRACE] ${trace.line}`);
    },
  },
});

// All operations will now emit audit events
const repo = await git.open('/path/to/repo');
await repo.status();
```

**Audit Event Types:**
- `AuditEventStart`: Emitted before command execution with `argv`, `context`, `timestamp`
- `AuditEventEnd`: Emitted after completion with `stdout`, `stderr`, `exitCode`, `duration`, `aborted`
- `TraceEvent`: GIT_TRACE output lines with `timestamp` and `line`

### Push LFS objects through standard input

```typescript
await repo.lfs.push({
  remote: 'origin',
  objectId: oids, // string or string[] of LFS object IDs
  stdin: true,
});
```

Runs `git lfs push --object-id origin --stdin`, sending one OID per line and
closing standard input. This avoids command-line length limits for large OID lists.
Omit `stdin` to pass object IDs as command-line arguments.

## Security model

type-git checks where an untrusted value, such as a branch name, remote URL or path typed by a
user, could otherwise turn into a Git option. It does not make every input safe. This section
lists what each API level checks and what stays the caller's responsibility.

**High-level API** (`repo.status()`, `git.clone()`, `repo.fetch()`, …)

- Remotes, URLs, refs, paths and other positional operands that start with `-` are refused
  with `GitArgumentError` before Git starts, because Git would parse them as options such as
  `--upload-pack=<command>`. Many path lists are also passed after `--`.
- Option names come from the typed option fields. A caller's string becomes an option value or
  an operand, not a new option.
- `git.clone(url, path, { config })` accepts only data-only configuration keys (see
  `CloneConfigSchema`). Keys such as `protocol.ext.allow`, `include.path`, `core.sshCommand`
  or `core.fsmonitor` are refused, because `git clone -c` would apply them to the first fetch.
  Transport keys such as `http.sslVerify`, `http.proxy` and `http.extraHeader` are accepted:
  they cannot run a program, but they decide which server is trusted and what is sent to it.
- Some options exist to run a program, and they run what you give them. Treat these values
  as code: `config.set()`, `config.add()` and `config.setRaw()` (for example `core.sshCommand`,
  `core.pager`, `gpg.program`), `submodule.foreach()`, `rebase({ exec })`, the merge
  `strategy` (Git runs `git-merge-<strategy>`) and the `credentialHelper` open option.

**Strict API** (`strict(repo).command(...)`)

- Options are checked against Git's option grammar. Only canonical option names are accepted:
  abbreviations such as `--upload-p` and bundled short options that hide another option, such as
  `-vu`, are refused.
- An `{ operand }` that starts with `-` is refused wherever Git would read it as an option, for
  example before an explicit `['--']`.

**Raw API** (`git.raw(argv)`, `repo.raw(argv)`)

- `raw()` passes `argv` to Git unchanged and checks nothing. Build its argv only from trusted
  values. Send untrusted data on standard input with the `stdin` option instead of in argv, but
  only to a command that reads standard input as data, such as `hash-object --stdin` or
  `commit -F -`. Commands that read standard input as instructions, such as `fast-import` or
  `update-ref --stdin`, let that input create or move refs, so do not feed them untrusted input.

**Environment**

- Spawned Git processes inherit only an allowlist of the parent environment
  (`DEFAULT_ENV_ALLOWLIST`), so other application secrets are not passed on. No variable that
  names a program Git runs, such as `GIT_SSH_COMMAND`, `GIT_ASKPASS`, `GIT_EXTERNAL_DIFF` or
  `GIT_PAGER`, is inherited by default. Opt one in with `inheritEnv: ['GIT_SSH_COMMAND']`, or
  pass it with the `env` option, when you trust the value.
- `inheritEnv: true` passes the whole parent environment, including application secrets and the
  program-naming variables above. A predicate passed as `inheritEnv` bypasses
  `DEFAULT_ENV_ALLOWLIST` and passes exactly the variables it selects. Use these forms only when
  every variable they can select is trusted.
- The allowlist does pass `PATH` (which picks the `ssh`, `git-lfs` and `git-remote-*` programs),
  `HOME` (and so `~/.gitconfig`), the proxy variables (whose URLs may hold credentials) and the
  SSH agent variables. An HTTPS-only application can drop the agent with
  `inheritEnv: { remove: ['SSH_AUTH_SOCK', 'SSH_AGENT_PID'] }`.

**Untrusted repositories** (`git.open(path, { untrusted: true })`)

- Git runs whatever a repository's own configuration and hooks name, such as `core.fsmonitor`,
  hooks, and clean, smudge or diff filters. By default, opening a repository directory that
  someone else controls is as dangerous with type-git as running `git status` in it yourself.
- With `untrusted: true` (also on `openBare()` and `openRaw()`), every command runs with `-c`
  overrides that point `core.hooksPath` at a path that cannot hold hooks, turn off
  `core.fsmonitor`, refuse the `ext::` transport and set `safe.bareRepository=explicit`.
  Opening fails with `GitError` kind `'UnsafeRepoConfig'` when the repository's own
  configuration (`local` and `worktree` scopes, including included files) sets any key outside a
  closed list of data-only keys. The list covers the usual keys that `git init`, `git clone`,
  `git sparse-checkout` and `git lfs install` write, `branch.<name>.*` and similar; driver keys
  such as `diff.<driver>.textconv` cannot be overridden by name, so they are refused instead.
  The configuration of every populated submodule is checked the same way, because Git runs
  commands such as `status` inside submodules.
- Remote and submodule URLs in that configuration must be `https`, `http`, `ssh`, `git` or
  scp-style URLs. A local path or `file://` URL would make Git run `upload-pack` or
  `receive-pack` in another repository without the overrides, so its hooks and configuration
  would run unchecked. The same holds for a local path you pass yourself as a remote, so pass
  one only when you trust that repository.
- The check runs once, when the repository is opened, so nobody else may change the directory
  while you use it. Your own global and system configuration is still trusted. Open a worktree
  by its top-level directory, not its `.git` directory. Untrusted mode needs Git 2.38 or later.

**Not covered**
- A cloned repository does not carry the remote's configuration or hooks. Its `.gitattributes`
  can still select filters that your own configuration defines, and its `.gitmodules` and
  `.lfsconfig` still steer submodule and LFS transfers. The clone `template` option and your
  `init.templateDir` copy hooks into the new repository.

## Architecture

```
src/
├── core/           # Core types and interfaces
├── adapters/       # Runtime-specific implementations
│   ├── node/       # Node.js adapter
│   ├── bun/        # Bun adapter
│   └── deno/       # Deno adapter
├── constraints/    # Declarative Git rules, type projection, and finite-domain exploration
├── impl/           # Git and repository operations
├── runner/         # Command execution, progress, and errors
├── parsers/        # Machine-output parsers
└── internal/       # Shared clients, transport, config, and LFS helpers
```

## Development Status

0.4.0 strengthens typed output contracts and rejects conflicting options before execution.
See the [migration guide](docs/migrations/0.4.0.md) for breaking changes and API boundaries.
The public API is still evolving; pin an exact version for controlled upgrades.
Some flags require newer Git versions; LFS JSON queries require a compatible Git LFS installation.

Option restrictions are maintained in an [evidence-backed constraint model](docs/design/option-constraints.md).
Git restrictions and typed API exceptions are listed separately. Clone has generated finite-domain
compiler tests and independent Git conformance tests; this does not claim exhaustive Git coverage.

### Validation scope

- **Node.js**: Unit and real-Git integration tests run in CI on Linux and Windows
  with Node.js 20, 22, and 24. A separate job checks legacy Git 2.25 compatibility.
- **Bun and Deno**: Adapter smoke tests and a shared repository contract suite run on Linux.
  Their test coverage is narrower than Node.js; cross-runtime behavior still needs
  more real-application feedback.
- **Package distribution**: CI installs the npm tarball and checks ESM, CommonJS,
  and TypeScript consumers. Repository API type assertions are also compiled in CI.
- **LFS**: Automated tests cover command construction, progress callback wiring,
  and smudge-mode handling, primarily with mocked adapters. Remote-service
  authentication, interrupted transfers, and large transfers need further validation.
- **macOS**: Not currently included in the CI matrix.

### Toward 1.0

The 1.0 release will establish a public API maintained with semantic versioning.
Before then, the priorities are sustained use in real applications, broader Git/LFS
transfer and failure-path validation, and settling the contracts for errors,
cancellation, progress callbacks, and environment inheritance. Full coverage of
every Git command-line option is not a release requirement; `raw()` remains the
escape hatch.

Please report issues with your type-git, runtime, Git, and Git LFS versions,
operating system, and a minimal reproduction. Remove credentials from logs before
sharing them.

## License

MIT - see [LICENSE](LICENSE)
