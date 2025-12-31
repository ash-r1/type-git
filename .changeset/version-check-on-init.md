---
"type-git": minor
---

Add Git version check on initialization

- Add `TypeGit.create()` static method that performs Git version validation
- Throw `GitError` with kind `UnsupportedGitVersion` if Git version is below minimum (2.25.0)
- Deprecate constructor in favor of `TypeGit.create()` for version safety
