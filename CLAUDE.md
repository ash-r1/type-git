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

# Changeset (versioning)
pnpm changeset       # Create a new changeset
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

## Git Workflow

- **Do not push directly to main**: The main branch is protected
- Always create a feature branch and submit a Pull Request
- Branch naming: `feature/*`, `fix/*`, `chore/*`, etc.
- **Include a changeset**: For any changes that affect the public API or behavior, add a changeset with `pnpm changeset`

```bash
# Example workflow
git checkout -b feature/my-feature
# ... make changes ...
pnpm changeset              # Add a changeset describing the change
git add .
git commit -m "feat: add my feature"
git push -u origin feature/my-feature
# Then create a PR via GitHub
```

### Claude Code: Commit, Push, PR Pattern

When completing a task, follow this standard pattern:

1. **Commit**: Stage and commit with conventional commit message
2. **Push**: Push to remote (use `-u` for new branches)
3. **PR**: Create or update a Pull Request

```bash
# For new branches
git add <files>
git commit -m "feat: description"
git push -u origin <branch-name>
gh pr create --title "feat: description" --body "## Summary\n- Changes\n\n## Test plan\n- [ ] Tests"

# For existing PR branches
git add <files>
git commit -m "feat: description"
git push
# PR is automatically updated
```

## Versioning & Release

This project uses [Changesets](https://github.com/changesets/changesets) for version management and releases.

### Adding a Changeset

When making changes that should be released, add a changeset:

```bash
pnpm changeset
```

This will prompt you to:
1. Select the type of change (major/minor/patch)
2. Write a summary of the changes

Changeset files are committed with your PR and describe what changes will be included in the next release.

### Release Process

1. When PRs with changesets are merged to `main`, the release workflow automatically creates/updates a "Release PR"
2. The Release PR accumulates all changesets and shows the pending version bump
3. When the Release PR is merged:
   - Package version is updated
   - CHANGELOG.md is generated
   - Package is published to npm
   - Git tag (e.g., `v1.0.0`) is created
