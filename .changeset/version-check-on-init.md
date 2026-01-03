---
"type-git": minor
---

Add Git version check on initialization

- Add `TypeGit.create()` static method that performs Git version validation
- Require Git 2.30.0+ by default (recommended for modern distributions)
- Add `useLegacyVersion` option to allow Git 2.25.0+ (e.g., Ubuntu 20.04 LTS default)
- Throw `GitError` with kind `UnsupportedGitVersion` if Git version is below minimum
- Deprecate constructor in favor of `TypeGit.create()` for version safety
- Add CI test for legacy Git 2.25.x compatibility
