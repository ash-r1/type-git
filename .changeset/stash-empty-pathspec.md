---
'type-git': patch
---

`stash push` and assumed `stash` push now reject an empty pathspec (`''`) at compile time and before execution, matching Git's "empty string is not a valid pathspec" error. A help exit before the pathspec still passes through.
