---
"type-git": minor
---

Add `untrusted: true` to `git.open()`, `openBare()` and `openRaw()` for repository directories written by someone else (Git 2.38 or later). Every command then runs with hooks and the filesystem monitor turned off, the `ext::` transport refused and implicit bare repositories refused, and opening fails with `GitError` kind `'UnsafeRepoConfig'` when the repository's own configuration sets any key outside a closed list of data-only keys, such as `core.fsmonitor`, `include.path`, `alias.*` or `diff.<driver>.textconv`, or a remote or submodule URL that is a local path.
