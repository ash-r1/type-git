---
'type-git': patch
---

`repo.show()` now checks combinations of `stat`, `nameOnly`, `nameStatus` and `quiet` at compile time and at runtime. The `format`, decoration and mailmap strings are still passed to Git unchecked.

- `nameOnly` with `nameStatus` is rejected. Previously `nameStatus` was silently dropped.
- `quiet` with `nameOnly` or `nameStatus` is rejected. Git parses `--quiet` before the other diff options, so `diff_setup_done` fails. Git 2.55.0 accepts the pair when `--stat` is also given, but older releases such as Git 2.25 reject it, so `stat` does not lift the rule.
