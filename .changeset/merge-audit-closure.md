---
'type-git': patch
---

The strict API now refuses an empty operand for `git merge`, which Git can never resolve to a commit. It also refuses a second `-s` that names a strategy outside the built-in table: Git resolves at most one custom strategy per run. The merge audit is now complete: its closure over `builtin/merge.c` names every refusal site of the Git 2.55.0 source and is checked against 8,959 independent Git 2.55.0 merges. `-X` values, an empty `-m`, strategy names and message files stay with Git, because Git refuses them only when a strategy runs, a merge commit is written, or the file or strategy is missing.
