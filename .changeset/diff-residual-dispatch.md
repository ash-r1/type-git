---
"type-git": patch
---

Match `git diff` argument dispatch to Git 2.55.0. `-h` is a residual word after `setup_revisions`, so option and combination errors (for example `--name-only --name-status -h`) are reported instead of being skipped as help. Without revisions, `--merge-base` and a non-first `--help` are rejected in the diff-files branch, and `--cached` rejects `--base`/`--ours`/`--theirs`/`-q` and non-default counts or numeric ages. Detached values that would become the path separator (`--`) or switch to no-index mode (`-S --no-index`) are rejected, `--follow` needs exactly one pathspec, and the aborting `--no-ignore-matching-lines` negation is no longer offered. `diff --no-index` rejects pathspecs after a `-` stdin path and `--follow`. Outcomes are checked against an independent Git 2.55.0 corpus with literal-type witnesses.
