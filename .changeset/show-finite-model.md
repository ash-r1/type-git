---
'type-git': patch
---

`repo.show()` options are now checked against Git 2.55.0 at compile time and at runtime:

- `nameOnly` with `nameStatus` is rejected. Previously `nameStatus` was silently dropped.
- `quiet` with `nameOnly` or `nameStatus` is rejected unless `stat` is also set. Git parses `--quiet` before the other diff options, so `diff_setup_done` would otherwise fail.
