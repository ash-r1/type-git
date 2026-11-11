---
'type-git': patch
---

Align typed `git diff` arguments with Git 2.55.0 option grammar and rule combinations. `--max-depth` with a non-negative value is now refused without revisions (Git dies for worktree and `--cached` index diffs), and `--no-walk` still in effect together with `--graph` is refused for every revision-walking command, as `setup_revisions` does; a later `-n`/`--max-count` re-enables walking. Both are checked against an independent native corpus of 2,992 Git 2.55.0 outcomes covering every typed diff option spelling, sampled value grammars, rule-family pairs and operand forms.
