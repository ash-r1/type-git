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

1. **Output Contract Safety**: Typed APIs only expose operations where stdout format is guaranteed
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

## Architecture

```
src/
├── core/           # Core types and interfaces
├── adapters/       # Runtime-specific implementations
│   ├── node/       # Node.js adapter
│   ├── bun/        # Bun adapter
│   └── deno/       # Deno adapter
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
