# type-git

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
