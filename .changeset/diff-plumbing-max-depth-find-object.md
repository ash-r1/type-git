---
"type-git": patch
---

`strict(...).command('diff-files' | 'diff-index', ...)` now refuses a non-negative final `--max-depth`, which Git rejects for worktree and index diffs, and `--find-object` combined with `--pickaxe-regex`, `-i` or `--regexp-ignore-case`, which aborts Git with an internal BUG(). A residual `-h` still exits with usage first. `diff-tree` is unchanged.
