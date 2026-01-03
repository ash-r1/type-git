# type-git

Type-safe Git wrapper library with LFS support, progress tracking, and abort control for Node.js/Deno/Bun.

(To be honest, I wrote the entire code with Claude Code. But it works appropriately.)

**[Documentation](https://ash-r1.github.io/type-git/)** | **[API Reference](https://ash-r1.github.io/type-git/api/readme/)**

## Features

- **Type-safe API**: Full TypeScript support with proper type inference
- **Repository-context aware**: Distinguishes between repository-agnostic and repository-specific operations
- **Git LFS support**: Built-in support for Git LFS with progress tracking
- **Progress tracking**: Real-time progress events for clone, fetch, push, and LFS operations
- **Abort control**: Cancel operations using AbortController
- **Cross-runtime**: Works with Node.js, Deno, and Bun
- **No cwd dependency**: Uses `git -C` for clean repository context management

## Design Philosophy

This library wraps Git CLI (and optionally libgit2) with a focus on:

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
    if (progress.kind === 'git') {
      console.log(`${progress.phase}: ${progress.message}`);
    } else if (progress.kind === 'lfs') {
      console.log(`LFS ${progress.direction}: ${progress.bytesSoFar}/${progress.bytesTotal}`);
    }
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

## Architecture

```
src/
├── core/           # Core types and interfaces
├── adapters/       # Runtime-specific implementations
│   ├── node/       # Node.js adapter
│   ├── bun/        # Bun adapter
│   └── deno/       # Deno adapter
├── cli/            # CLI command builders
├── lfs/            # LFS-specific logic
├── parsers/        # Output parsers
└── utils/          # Utilities
```

## Development Status

This library is currently in early development (v0.0.1). It's not tested well. Especially, on Bun/Deno.

## License

MIT - see [LICENSE](LICENSE)
