---
"type-git": patch
---

Align `repo.add()` options with Git's final `add` checks: `ignoreMissing` now requires `dryRun`, `chmod` is checked at runtime as `+x` or `-x`, `all` with `update` is accepted when `ignoreRemoval` resets Git's shared mode, and `all` with `ignoreRemoval` is rejected because the emitted `--ignore-removal` silently cancels `--all`. The typed `add` command rules are now backed by an independent Git 2.55.0 corpus of mode, edit/interactive precedence, pathspec-file pointer and value outcomes, with Git 2.25.1 filename-pointer differences kept as explicit legacy cases.
