# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**type-git** is a type-safe Git wrapper library for Node.js, Deno, and Bun. It provides:
- Type-safe API with full TypeScript support
- Git LFS support with progress tracking
- AbortSignal support for cancellation
- Cross-runtime support via adapter pattern

## Architecture

### Directory Structure

```
src/
├── core/           # Core types, interfaces, and abstractions
│   ├── adapters.ts # ExecAdapter & FsAdapter interfaces
│   ├── git.ts      # Git interface (repo-agnostic operations)
│   ├── repo.ts     # Repository interfaces (WorktreeRepo, BareRepo)
│   └── types.ts    # Core types (Progress, Error, Capabilities, etc.)
├── adapters/       # Runtime-specific implementations
│   ├── node/       # Node.js adapter (child_process, fs/promises)
│   ├── bun/        # Bun adapter (Bun.spawn, Bun.file)
│   └── deno/       # Deno adapter (Deno.Command)
├── impl/           # Implementation layer
│   ├── git-impl.ts           # GitImpl class
│   ├── worktree-repo-impl.ts # WorktreeRepoImpl (standard repos)
│   └── bare-repo-impl.ts     # BareRepoImpl (bare repos)
├── runner/         # CLI execution engine
│   └── cli-runner.ts         # CliRunner (command construction, progress tracking)
├── parsers/        # Output parsing utilities
│   └── index.ts    # Git output parsers (status, log, progress, etc.)
└── index.ts        # Main entry point
```

### Three-Level API Design

1. **Raw API**: `git.raw(argv)` / `repo.raw(argv)` - Returns RawResult (stdout, stderr, exitCode)
2. **Typed API**: `repo.status()`, `repo.log()` - Type-safe with parsed output
3. **High-Level API**: `repo.commit()`, `repo.branch.create()` - Convenience methods

### Key Design Principles

- **No cwd dependency**: Uses `git -C <path>` for clean context management
- **Repository context separation**: `Git` (repo-agnostic) vs `Repo` (repo-specific)
- **Output Contracts**: Typed APIs only for predictable output formats (porcelain, JSON)
- **Adapter pattern**: Runtime-specific code isolated in adapters

## Development Commands

```bash
# Build
pnpm build           # TypeScript compilation

# Test
pnpm test            # Vitest (watch mode)
pnpm test:ci         # Vitest (single run)
pnpm test:bun        # Bun smoke tests
pnpm test:deno       # Deno smoke tests

# Lint & Format
pnpm lint            # Biome linter
pnpm lint:fix        # Fix lint issues
pnpm format          # Format with Biome
pnpm check           # Lint + Format check
pnpm check:fix       # Fix all issues

# Type Check
pnpm typecheck       # TypeScript --noEmit
```

## Usage Examples

```typescript
// Node.js - Convenience API
import { TypeGit } from 'type-git/node';
const git = new TypeGit();
const repo = await git.open('/path/to/repo');
const status = await repo.status();

// Advanced - Custom adapters
import { createGit } from 'type-git';
import { createNodeAdapters } from 'type-git/node';
const git = createGit({ adapters: createNodeAdapters() });
```

## Key Types

- **Git**: Repo-agnostic operations (`clone`, `init`, `lsRemote`, `version`, `raw`)
- **WorktreeRepo**: Standard repo operations (`status`, `log`, `branch`, `commit`, `lfs.*`)
- **BareRepo**: Limited bare repo operations (`fetch`, `push`, `raw`)
- **ExecAdapter**: Process spawning interface
- **FsAdapter**: File system operations interface
- **GitError**: Extended Error with `kind`, `category`, `argv`, `exitCode`, `stdout`, `stderr`

## Testing

- **Vitest**: Main test framework for Node.js (`src/**/*.test.ts`)
- **Bun test**: Smoke tests for Bun runtime (`test/bun/`)
- **Deno test**: Smoke tests for Deno runtime (`test/deno/`)

## Code Style

- Biome for linting and formatting
- Single quotes, semicolons, 2-space indent
- Max line width: 100 characters
- Strict TypeScript (no explicit any, no unused variables)
