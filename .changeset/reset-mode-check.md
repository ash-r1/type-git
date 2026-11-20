---
"type-git": patch
---

`repo.reset(target, { mode })` now refuses a `mode` other than `soft`, `mixed`, `hard`, `merge` or `keep` with `GitArgumentError` before Git starts. The mode becomes `--<mode>`, so an unchecked string from JavaScript or untrusted input could name any other reset option, such as `--pathspec-from-file=<file>`.
