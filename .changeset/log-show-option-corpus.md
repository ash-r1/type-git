---
'type-git': patch
---

Align typed `git log` and `git show` arguments with Git 2.55.0 option grammar and rule combinations, checked against an independent corpus of 6,908 native outcomes covering every typed log/show option spelling (except help, completion and `--end-of-options` exits), sampled value grammars, rule-family pairs and operand forms:

- `git show --graph` is refused unless a later `--do-walk`, `-n`, `--max-count` or `--max-count-oldest` re-enables walking (`git show` starts with `--no-walk` in effect).
- `--follow` without a pathspec, with more than one path after `--`, or with `--full-diff` is refused for log and show.
- `--find-object` with `--pickaxe-regex` or `-i` is refused for log and show (Git aborts with `BUG()`).
- `-L` is refused together with `--check` and the stat, numstat, shortstat and dirstat formats, unless `--name-only`, `--name-status`, `-s` or a later `--no-no-patch` drops them. The `-L <range>:<file>` value syntax is left to Git.
- The first-pass `--quiet`/`-q` of log and show now suppresses output before diff options are parsed, so it conflicts with `--name-only`, `--name-status` and `--check` unless a later format option clears it.
