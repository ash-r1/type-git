# type-git

## 0.3.0-alpha.2

### Minor Changes

- [#122](https://github.com/ash-r1/type-git/pull/122) [`49edd4e`](https://github.com/ash-r1/type-git/commit/49edd4ec68fd01adbb1e2999b24d415b85c29ad6) Thanks [@ash-r1](https://github.com/ash-r1)! - Add deny-list and predicate forms to `inheritEnv`

  `inheritEnv` previously only accepted `true` / `false` / `string[]`, so the
  default allowlist could be extended but never trimmed — dropping a single
  default entry (e.g. `SSH_AUTH_SOCK` for an HTTPS-only app) meant rebuilding the
  whole list by hand.

  Two new forms are now supported:

  - `{ add?: string[]; remove?: string[] }` — start from the default allowlist,
    add `add`, then subtract `remove` (`remove` wins on conflicts). For example
    `inheritEnv: { remove: ['SSH_AUTH_SOCK', 'SSH_AGENT_PID'] }`.
  - `(name: string) => boolean` — a predicate that decides each variable
    individually, bypassing the default allowlist entirely.

  `DEFAULT_ENV_ALLOWLIST` documentation now also calls out that the SSH agent vars
  (`SSH_AUTH_SOCK` / `SSH_AGENT_PID`) are included by default (and how to drop
  them), while the most credential-prone helpers (`GIT_ASKPASS` / `SSH_ASKPASS` /
  `GIT_PROXY_COMMAND`) are intentionally excluded.

- [#119](https://github.com/ash-r1/type-git/pull/119) [`3fcf335`](https://github.com/ash-r1/type-git/commit/3fcf335ddbf9726ca6bbee5adddd40e435ac9e0e) Thanks [@ash-r1](https://github.com/ash-r1)! - Forward `onLfsProgress` through `pull` and the LFS transfer operations

  `onLfsProgress` was accepted on these methods' option types (via `ExecOpts`)
  but was never wired to the runner, so the callback silently never fired.
  LFS transfer progress is now reported during `repo.pull()`, `repo.lfs.pull()`,
  `repo.lfs.push()`, `repo.lfs.fetch()`, `repo.lfsExtra.preUpload()` and
  `repo.lfsExtra.preDownload()`, matching the existing `clone` / `push` behavior.

  The `--progress` enablement gate was also broadened from `onProgress` to
  `onProgress || onLfsProgress` (in `clone`, `push`, `pull` and `lfs.fetch`) so
  that passing only `onLfsProgress` still requests progress output.

- [#120](https://github.com/ash-r1/type-git/pull/120) [`e9a7f67`](https://github.com/ash-r1/type-git/commit/e9a7f6702529b589b422fa7366769c93b6c5c8b9) Thanks [@ash-r1](https://github.com/ash-r1)! - Honor the object-form LFS mode (`open({ lfs: { skipSmudge } })`)

  Previously the object form of `LfsMode` (`{ skipSmudge?, skipDownload? }`) was
  stored but never consulted — only the string `'disabled'` had any effect, so
  `open({ lfs: { skipSmudge: true } })` was a silent no-op and checkout/pull still
  smudged LFS files.

  Now, when a repository is opened (or reconfigured via `setLfsMode`) with an
  object-form mode requesting `skipSmudge` and/or `skipDownload`, the
  working-tree-populating operations — `checkout`, `switch`, `reset`, `merge`,
  `pull`, `rebase` and `restore` — run with `GIT_LFS_SKIP_SMUDGE=1`. Git leaves
  LFS pointer files in place instead of downloading their contents. The objects
  can be materialized later via the explicit `repo.lfs.pull()` /
  `repo.lfs.checkout()` helpers, which use dedicated git-lfs commands and are not
  affected by the variable.

### Patch Changes

- [#117](https://github.com/ash-r1/type-git/pull/117) [`780c445`](https://github.com/ash-r1/type-git/commit/780c445363f0a9290b4e9578968613b651775b23) Thanks [@ash-r1](https://github.com/ash-r1)! - Add common Git transport configuration variables to the default environment allowlist

  Following the environment variable traversal prevention change, Git's own SSH transport and TLS configuration variables were no longer inherited by default, which could break workflows relying on them (e.g. a custom SSH command).

  The default allowlist now also inherits these Git configuration variables, which are commonly needed for transport configuration: `GIT_SSH`, `GIT_SSH_COMMAND`, `GIT_SSH_VARIANT`, `GIT_SSL_CAINFO`, `GIT_SSL_CAPATH`, `GIT_TERMINAL_PROMPT`, and `GIT_CONFIG_NOSYSTEM`. These are configuration rather than application secrets (though, depending on local setup, values such as `GIT_SSH_COMMAND` may name a command Git executes).

  Credential-carrying / askpass variables — `GIT_ASKPASS`, `SSH_ASKPASS`, and `GIT_PROXY_COMMAND` — are intentionally **not** inherited by default, since they can carry inline credentials or invoke a helper that reads secrets from the environment. Opt into those (and any other variables) explicitly via `inheritEnv` when needed.

## 0.3.0-alpha.1

### Minor Changes

- [#115](https://github.com/ash-r1/type-git/pull/115) [`057469d`](https://github.com/ash-r1/type-git/commit/057469d625dc71f963fe5f4b6c4e600a57089033) Thanks [@ash-r1](https://github.com/ash-r1)! - Stop implicitly inheriting the full parent process environment (environment variable traversal prevention)

  Previously, every spawned Git command inherited the entire parent process environment. This leaked secrets that happen to live in the parent process (cloud credentials, API tokens, etc.) into Git and any tools it shells out to — credential helpers, hooks, and LFS transfer agents — which is an environment variable traversal risk.

  Now, only a curated allowlist of variables that Git genuinely needs to operate (e.g. `PATH`, `HOME`, locale, `SSH_AUTH_SOCK`, proxy settings, and Windows essentials) is inherited by default. Sensitive variables are no longer forwarded.

  A new `inheritEnv` option controls this behavior on `createGit()`, `git.open()`/`openBare()`/`openRaw()`, and `CliRunner`:

  - `undefined` (default): inherit only the built-in safe allowlist (`DEFAULT_ENV_ALLOWLIST`).
  - `true`: inherit the entire parent environment (previous behavior, opt-in).
  - `false`: inherit nothing beyond explicitly provided `env`.
  - `string[]`: inherit the default allowlist plus the named variables.

  ```typescript
  // Opt a specific variable back in
  const git = await createGit({
    adapters: createNodeAdapters(),
    inheritEnv: ['MY_CUSTOM_VAR'],
  });

  // Restore the previous "inherit everything" behavior
  const repo = await git.open('/path/to/repo', { inheritEnv: true });
  ```

  **Breaking:** Workflows that relied on arbitrary parent environment variables reaching Git (for example a commit-signing or credential helper that reads a token from the environment) must now opt those variables back in via `inheritEnv`.

  New exports: `EnvInheritance`, `DEFAULT_ENV_ALLOWLIST`, `resolveInheritedEnv`.

## 0.3.0-alpha.0

### Minor Changes

- [#112](https://github.com/ash-r1/type-git/pull/112) [`ba48835`](https://github.com/ash-r1/type-git/commit/ba488351c32bf67b52a7079527520815b25d9035) Thanks [@ash-r1](https://github.com/ash-r1)! - Add audit mode for command lifecycle tracking

  New `audit` configuration option in `createGit()` provides hooks for observing Git command execution:

  - `onAudit(event)`: Receives start/end events for every Git command
  - `onTrace(trace)`: Receives GIT_TRACE output lines when enabled

  Example usage:

  ```typescript
  const git = await createGit({
    adapters: createNodeAdapters(),
    audit: {
      onAudit: (event) => {
        if (event.type === 'start') {
          console.log(`Starting: ${event.argv.join(' ')}`);
        } else {
          console.log(`Completed in ${event.duration}ms (exit ${event.exitCode})`);
        }
      },
      onTrace: (trace) => {
        console.log(`[GIT_TRACE] ${trace.line}`);
      },
    },
  });
  ```

  Types exported: `AuditEvent`, `AuditEventStart`, `AuditEventEnd`, `TraceEvent`, `AuditConfig`

- [#114](https://github.com/ash-r1/type-git/pull/114) [`44f4e09`](https://github.com/ash-r1/type-git/commit/44f4e099f2196e53601d1ae1bd1fc11e3a5a0ad2) Thanks [@ash-r1](https://github.com/ash-r1)! - Forward `onLfsProgress` callback through `clone` and `push`

  `onLfsProgress` was already accepted on these methods' option types but was
  not wired to the runner. LFS transfer progress is now reported during
  `git.clone()` (downloads) and `repo.push()` (uploads), matching existing
  `onProgress` behavior.

## 0.2.0

### Minor Changes

- [#110](https://github.com/ash-r1/type-git/pull/110) [`1874124`](https://github.com/ash-r1/type-git/commit/187412417648551e88d8263e690d53bb28c98a13) Thanks [@ash-r1](https://github.com/ash-r1)! - Add `await using` support with `Symbol.asyncDispose` for automatic resource cleanup

  - `SpawnHandle` now implements `AsyncDisposable`, allowing automatic process cleanup with `await using`
  - `TailHandle` now implements `AsyncDisposable`, allowing automatic file handle cleanup with `await using`
  - Added `ESNext.Disposable` to TypeScript lib configuration
  - Backward compatible: existing `kill()` and `stop()` methods continue to work as before

  Example usage:

  ```typescript
  // Automatic cleanup when scope exits (new)
  await using handle = adapter.spawnStreaming({ argv: ['git', 'fetch'] });
  for await (const line of handle.stdout) {
    console.log(line);
  }
  // Process automatically terminated and cleaned up

  // Traditional usage still works (existing)
  const handle = adapter.spawnStreaming({ argv: ['git', 'fetch'] });
  try {
    for await (const line of handle.stdout) {
      console.log(line);
    }
  } finally {
    handle.kill();
  }
  ```

## 0.1.1

### Patch Changes

- [#105](https://github.com/ash-r1/type-git/pull/105) [`9118d58`](https://github.com/ash-r1/type-git/commit/9118d58f94fd86ef780f65f25a100c2b5ed20715) Thanks [@ash-r1](https://github.com/ash-r1)! - Fix parseGitLog hash field not being trimmed when previous commit body ends with newline

## 0.1.0

### Minor Changes

- [#84](https://github.com/ash-r1/type-git/pull/84) [`b3a6260`](https://github.com/ash-r1/type-git/commit/b3a6260974b72ca4bb0d4735d46fa8e078931daa) Thanks [@ash-r1](https://github.com/ash-r1)! - Add Git version check on initialization

  - Add `TypeGit.create()` static method that performs Git version validation
  - Require Git 2.30.0+ by default (recommended for modern distributions)
  - Add `useLegacyVersion` option to allow Git 2.25.0+ (e.g., Ubuntu 20.04 LTS default)
  - Throw `GitError` with kind `UnsupportedGitVersion` if Git version is below minimum
  - Deprecate constructor in favor of `TypeGit.create()` for version safety
  - Add CI test for legacy Git 2.25.x compatibility

### Patch Changes

- [#93](https://github.com/ash-r1/type-git/pull/93) [`4b54b1d`](https://github.com/ash-r1/type-git/commit/4b54b1dd32d14fc46dd40507fcc6b69444b39a86) Thanks [@ash-r1](https://github.com/ash-r1)! - Fix biome lint warnings by moving regex literals to top-level constants and removing unnecessary async modifiers

- [#90](https://github.com/ash-r1/type-git/pull/90) [`6c9b01c`](https://github.com/ash-r1/type-git/commit/6c9b01cf841efabedd11bdb553955e59422a1232) Thanks [@ash-r1](https://github.com/ash-r1)! - Fix npm OIDC trusted publishing by updating to npm 11.5.1+

- [#97](https://github.com/ash-r1/type-git/pull/97) [`552e6c4`](https://github.com/ash-r1/type-git/commit/552e6c4b61bbe9eb294d3bf53d5db6894a787cc8) Thanks [@ash-r1](https://github.com/ash-r1)! - refactor: extract shared file polling logic to reduce cognitive complexity

  - Created `src/internal/file-polling.ts` shared module with `FilePollingAdapter` interface
  - Refactored `tail` and `tailStreaming` methods in Node.js, Bun, and Deno adapters to use the shared polling logic
  - Reduced code duplication across runtime adapters by ~70%
  - Eliminated 4 cognitive complexity warnings from Biome linter

- [#98](https://github.com/ash-r1/type-git/pull/98) [`79c8702`](https://github.com/ash-r1/type-git/commit/79c8702b91008ed370cf4900b8676f27b1300397) Thanks [@ash-r1](https://github.com/ash-r1)! - refactor: reduce cognitive complexity in remoteList, clone, and progress handling

  - Extract `parseRemoteLine`, `updateRemoteUrl`, `normalizeRemoteUrls` helpers for `remoteList`
  - Move regex patterns to top-level constants
  - Create `buildCloneArgs` helper using Options Map pattern for `clone` method
  - Extract `toLfsProgress`, `toGitProgress`, `processProgressLine` helpers for stderr progress handling
  - Reduces code duplication and improves maintainability

## 0.0.1

### Patch Changes

- [#81](https://github.com/ash-r1/type-git/pull/81) [`9aa2cb9`](https://github.com/ash-r1/type-git/commit/9aa2cb98f1304c5e1487bf7b1aeab6265f4e377a) Thanks [@ash-r1](https://github.com/ash-r1)! - Add lsTree method to RepoBase

  - Add `lsTree()` method to WorktreeRepo and BareRepo
  - Support options: `recursive`, `tree`, `path`, etc.
  - Return parsed tree entries with mode, type, hash, and path

- [#79](https://github.com/ash-r1/type-git/pull/79) [`debea12`](https://github.com/ash-r1/type-git/commit/debea12807c7dc67cc4fab0bb93678bff3942229) Thanks [@ash-r1](https://github.com/ash-r1)! - Add repository-scoped lsRemote method

  - Add `lsRemote()` method to WorktreeRepo and BareRepo
  - Enables listing remote references from within a repository context
  - Supports same options as `git.lsRemote()` with automatic remote resolution

- [#82](https://github.com/ash-r1/type-git/pull/82) [`7b7d1c6`](https://github.com/ash-r1/type-git/commit/7b7d1c64575b9fcd425ff0d382f1da4312615b3a) Thanks [@ash-r1](https://github.com/ash-r1)! - Add rev-parse with comprehensive options support

  - Add `revParse()` method to WorktreeRepo and BareRepo
  - Support various rev-parse options: `abbrevRef`, `symbolic`, `short`, `verify`, etc.
  - Parse output based on option combinations for type-safe results

- [#86](https://github.com/ash-r1/type-git/pull/86) [`6d0ebda`](https://github.com/ash-r1/type-git/commit/6d0ebda2dea78f3dc0dbd0147318acbd5ea7daa6) Thanks [@ash-r1](https://github.com/ash-r1)! - Add dual package support (ESM + CommonJS) using tsup

  - Build outputs both `.js` (ESM) and `.cjs` (CommonJS) formats
  - Add proper `require` and `import` conditions to package.json exports
  - Enable `require('type-git')` for CommonJS projects
  - Works with all `moduleResolution` settings (`bundler`, `node16`, `nodenext`)
