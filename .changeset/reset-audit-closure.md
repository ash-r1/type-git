---
'type-git': patch
---

`repo.reset(target)` now passes `--` after the target, so Git always takes the target as a revision. Before, a file or directory with the same name as the target made Git refuse the reset as ambiguous, and a target that did not name a commit was taken as a path.

The strict API now refuses an empty operand for `git reset`, which Git refuses wherever it appears: as an ambiguous first word, as an empty pathspec, or as a revision. The reset audit is now complete: its closure over `builtin/reset.c` names every refusal site of the Git 2.55.0 source and is checked against 6,370 independent Git 2.55.0 runs.
