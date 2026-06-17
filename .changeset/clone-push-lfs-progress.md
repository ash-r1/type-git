---
"type-git": minor
---

Forward `onLfsProgress` callback through `clone` and `push`

`onLfsProgress` was already accepted on these methods' option types but was
not wired to the runner. LFS transfer progress is now reported during
`git.clone()` (downloads) and `repo.push()` (uploads), matching existing
`onProgress` behavior.
