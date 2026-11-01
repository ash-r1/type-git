---
"type-git": patch
---

`add` now rejects an empty pathspec (`''`), matching Git's "empty string is not a valid pathspec" error for final and interactive add. The typed command API refuses it at compile time and before execution; `repo.add()` refuses it before execution (its `string | string[]` parameter still accepts `''` at compile time). After a final `--edit`, operands go to Git's revision parsing and the typed command API still passes them through unchanged.
