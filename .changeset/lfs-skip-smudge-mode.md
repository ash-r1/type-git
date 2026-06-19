---
"type-git": minor
---

Honor the object-form LFS mode (`open({ lfs: { skipSmudge } })`)

Previously the object form of `LfsMode` (`{ skipSmudge?, skipDownload? }`) was
stored but never consulted — only the string `'disabled'` had any effect, so
`open({ lfs: { skipSmudge: true } })` was a silent no-op and checkout/pull still
smudged LFS files.

Now, when a repository is opened (or reconfigured via `setLfsMode`) with an
object-form mode requesting `skipSmudge` and/or `skipDownload`, the
working-tree-populating operations — `checkout`, `switch`, `reset`, `merge`,
`pull`, `rebase` and `restore` — run with `GIT_LFS_SKIP_SMUDGE=1`. Git leaves
LFS pointer files in place instead of downloading their contents. The objects
can be materialized later via the explicit `repo.lfs.pull()` /
`repo.lfs.checkout()` helpers, which use dedicated git-lfs commands and are not
affected by the variable.
