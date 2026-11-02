---
"type-git": patch
---

`restore` now rejects an empty pathspec (`''`), matching Git's "empty string is not a valid pathspec" error. The typed command API refuses it at compile time and before execution, while `-h` still exits first. The shared path check used by `repo.add()`, `repo.rm()`, path-mode `repo.checkout()` and `repo.restore()` refuses `''` before execution, including when it is passed as a single string. An empty `pathspecFromFile` is no longer treated as conflicting with command-line paths, because these APIs never emit `--pathspec-from-file` for an empty value.
