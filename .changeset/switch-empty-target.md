---
"type-git": patch
---

`switch` now rejects an empty target, matching Git: an empty start point fails with "invalid reference" in every mode, and an empty `-c`, `-C` or `--orphan` name fails the branch-name check. The typed command API refuses both at compile time and before execution, while `-h` still exits first. `repo.switch('')` is refused before running Git.
