---
'type-git': minor
---

`repo.status()` now refuses `ignored: 'matching'` with `untracked: 'no'`, which Git rejects.

**Behavior change:** a numeric `findRenames` is now a whole percentage from 1 to 100, emitted as `--find-renames=<n>%`. Git reads digits without `%` as a fraction, so before this change `findRenames: 100` meant 10% and `findRenames: 5` meant 50%; values from 10 to 99 keep their meaning. `0` (which Git treats as its 50% default), fractions and values above 100 are now refused.

In the strict API, `['-u', '']` for `git status` and `git commit` is now emitted as `--untracked-files=` (no untracked files) instead of a bare `-u`, which meant all. The status audit scope is now complete under the new completion criterion.
