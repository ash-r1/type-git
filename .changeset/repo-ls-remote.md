---
"type-git": minor
---

Add repository-scoped lsRemote method

- Add `lsRemote()` method to WorktreeRepo and BareRepo
- Enables listing remote references from within a repository context
- Supports same options as `git.lsRemote()` with automatic remote resolution
