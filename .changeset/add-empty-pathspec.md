---
"type-git": patch
---

`add` now rejects an empty pathspec (`''`) at compile time and before execution, in both the typed command API and `repo.add()`, matching Git's "empty string is not a valid pathspec" error for final and interactive add. After a final `--edit`, operands go to Git's revision parsing and are still passed through unchanged.
