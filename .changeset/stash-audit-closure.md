---
'type-git': patch
---

`git stash` checks now match Git 2.55.0 for empty operands, in the strict API (types and runtime): an empty stash reference for `stash apply`, `drop`, `pop` and `export`, an empty branch name or stash reference for `stash branch`, an empty commit for `stash store` (also with `--quiet`) and an empty revision for `stash import` are refused, as Git refuses them in every repository. `stash branch` also checks the new branch name against Git's ref name rules (names rewritten from `@{-N}` or upstream marks are left to Git), and `stash export --to-ref` must be a valid ref name other than `FETCH_HEAD` or `MERGE_HEAD`.

`repo.stash.apply()`, `pop()` and `drop()` now refuse an index that is not an integer from 0 to 99999999 with `GitArgumentError` before Git runs. Before, a negative or fractional index reached Git as `stash@{-1}` or `stash@{1.5}`, which Git reads as an invalid revision or a reflog date, and nine or more digits are read as a timestamp, so a different entry could be applied or dropped. `repo.stash.push({ paths })` now refuses an empty path, which Git rejects as a pathspec.

Every stash audit scope is now complete: each records a closure over `builtin/stash.c`, checked against independent Git 2.55.0 runs.
