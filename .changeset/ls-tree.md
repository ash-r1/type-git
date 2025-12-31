---
"type-git": minor
---

Add lsTree method to RepoBase

- Add `lsTree()` method to WorktreeRepo and BareRepo
- Support options: `recursive`, `tree`, `path`, etc.
- Return parsed tree entries with mode, type, hash, and path
