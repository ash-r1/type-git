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

```typescript
import { Git } from 'type-git';
import { NodeExecAdapter, NodeFsAdapter } from 'type-git/node';

// Create a Git client
const git = new Git({
  exec: new NodeExecAdapter(),
  fs: new NodeFsAdapter(),
});

// Clone a repository with progress tracking
const repo = await git.clone('https://github.com/user/repo.git', '/path/to/clone', {
  onProgress: (progress) => {
    if (progress.kind === 'git') {
      console.log(`${progress.phase}: ${progress.message}`);
    } else if (progress.kind === 'lfs') {
      console.log(`LFS ${progress.direction}: ${progress.current}/${progress.total}`);
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
