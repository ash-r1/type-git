---
'type-git': patch
---

Align typed `git diff` arguments with Git 2.55.0 option grammar and rule combinations, checked against an independent corpus of 3,090 native outcomes covering every typed diff option spelling, sampled value grammars, rule-family pairs and operand forms:

- `--max-depth` with a non-negative value is refused without revisions (Git dies for worktree and `--cached` index diffs).
- `--find-object` with `--pickaxe-regex` or `-i` is refused for `git diff` (Git aborts with `BUG()` when computing the diff).
- `--no-walk` still in effect together with `--graph` is refused for revision-walking commands, as `setup_revisions` does; a later `-n`/`--max-count` re-enables walking.
- `--exclude-hidden` accepts only `fetch`, `receive` and `uploadpack`.
