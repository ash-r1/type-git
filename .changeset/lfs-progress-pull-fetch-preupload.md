---
"type-git": minor
---

Forward `onLfsProgress` through `pull` and the LFS transfer operations

`onLfsProgress` was accepted on these methods' option types (via `ExecOpts`)
but was never wired to the runner, so the callback silently never fired.
LFS transfer progress is now reported during `repo.pull()`, `repo.lfs.pull()`,
`repo.lfs.push()`, `repo.lfs.fetch()`, `repo.lfsExtra.preUpload()` and
`repo.lfsExtra.preDownload()`, matching the existing `clone` / `push` behavior.

The `--progress` enablement gate was also broadened from `onProgress` to
`onProgress || onLfsProgress` (in `clone`, `push`, `pull` and `lfs.fetch`) so
that passing only `onLfsProgress` still requests progress output.
