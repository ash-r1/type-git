---
"type-git": minor
---

**Breaking:** move the grammar-checked `command()` to a new `type-git/strict` entry point.

`Git`, `WorktreeRepo`, `BareRepo` and `TypeGit` no longer have `command()`. Wrap a client or
repository with `strict()` from `type-git/strict` to get it back; the wrapper keeps every other
member. `GitCommandArgument`, `GitCommandClient`, `GitCommandExecOpts` and `GitCommandName` are
now exported from `type-git/strict`.

The main entry point keeps `raw()`, the high-level API and the runtime checks against argument
injection, but no longer loads the option-grammar catalogue or its types. An application that
only calls high-level methods such as `repo.status()` now bundles to about 180 KB minified
(1.6 MB in 0.6.0), and its type check no longer reads the 5 MB catalogue declarations. See
`docs/migrations/0.7.0.md`.
