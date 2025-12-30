# type-git

Type-safe Git wrapper library with LFS support, progress tracking, and abort control for Node.js/Deno/Bun.

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

const git = new TypeGit();

// Open an existing repository
const repo = await git.open('/path/to/repo');
const status = await repo.status();

// Clone a repository
const clonedRepo = await git.clone('https://github.com/user/repo.git', '/path/to/clone');

// Initialize a new repository
const newRepo = await git.init('/path/to/new-repo');
```

### Advanced Usage

For more control over adapters, you can use the factory function:

```typescript
import { createGit } from 'type-git';
import { createNodeAdapters } from 'type-git/node';

const git = createGit({
  adapters: createNodeAdapters(),
  // Additional options...
});
```

### Full Example

```typescript
import { TypeGit } from 'type-git/node';

const git = new TypeGit();

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

This library is currently in early development (v0.1.0). The initial focus is on:

- Core adapter interfaces (ExecAdapter, FsAdapter)
- Basic Git operations (clone, init, status, log, fetch, push)
- LFS support with progress tracking
- AbortSignal integration

## License

MIT - see [LICENSE](LICENSE)
