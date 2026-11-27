---
'type-git': minor
---

`repo.rebase` now refuses, before Git runs, option combinations that Git always refuses:

- `abort`, `continue` or `skip` together with any other option (Git prints usage);
- `apply` or `whitespace` together with an option that selects or requires the merge backend (`strategy`, `strategyOption`, `exec`, `rebaseMerges`, `updateRefs: true`, `autosquash: true`, `empty`, `rescheduleFailedExec: true`), with `root` without `onto`, with `reapplyCherryPicks` without `keepBase`, and `whitespace` with `ignoreWhitespace` unless `apply` is set;
- a `whitespace` value other than `nowarn`, `warn`, `error`, `error-all`, `fix` or `strip`;
- an `exec` command that contains a newline or is blank.

`empty` now also accepts `'stop'`, the current name of the deprecated `'ask'`.

The strict API (`type-git/strict`) now also checks `git rebase` values the way Git 2.55.0 does: `--trailer` must not be empty or start with `=`, `--exec` must not be blank or span lines, `-C` takes digits, `--whitespace` takes one of apply's actions (or an empty value), and an empty `--onto` or operand is refused. The rebase audit is now complete: its closure over `builtin/rebase.c` names every refusal site of the Git 2.55.0 source and is checked against 7,857 independent Git 2.55.0 rebases.
