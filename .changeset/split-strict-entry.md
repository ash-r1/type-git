---
"type-git": minor
---

**Breaking:** the grammar-checked `command()` is now available only through `type-git/strict`.

`Git`, `WorktreeRepo`, `BareRepo` and `TypeGit` no longer have `command()`, and `CliRunner.runCommand()` is removed; wrap a client or repository with `strict()` from `type-git/strict` instead (the wrapper keeps every other member). `GitCommandArgument`, `GitCommandClient`, `GitCommandExecOpts` and `GitCommandName` are no longer exported from the main entry point; import them from `type-git/strict`.

The main entry point keeps `raw()`, the high-level API and the runtime checks against argument injection, but no longer loads the option-grammar catalogue or its types. An application that only calls high-level methods such as `repo.status()` now bundles to about 180 KB minified (1.6 MB in 0.6.0), and its type check no longer reads the 5 MB catalogue declarations. See `docs/migrations/0.7.0.md`.
