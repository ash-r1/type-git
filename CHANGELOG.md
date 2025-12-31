# type-git

## 0.1.0

### Minor Changes

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

### Patch Changes

- [#86](https://github.com/ash-r1/type-git/pull/86) [`6d0ebda`](https://github.com/ash-r1/type-git/commit/6d0ebda2dea78f3dc0dbd0147318acbd5ea7daa6) Thanks [@ash-r1](https://github.com/ash-r1)! - Add dual package support (ESM + CommonJS) using tsup

  - Build outputs both `.js` (ESM) and `.cjs` (CommonJS) formats
  - Add proper `require` and `import` conditions to package.json exports
  - Enable `require('type-git')` for CommonJS projects
  - Works with all `moduleResolution` settings (`bundler`, `node16`, `nodenext`)
