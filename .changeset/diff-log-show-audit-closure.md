---
'type-git': minor
---

**Behavior change (strict API):** `strict(repo).command()` now checks more of `git diff`, `git log` and `git show` against Git 2.55.0, and the four audit scopes `diff`, `diff --no-index`, `log` and `show` are recorded as complete.

- `log -L` and `show -L` check the `<range>:<file>` syntax as Git does before it reads the repository: a `:` and a file name must follow the range, absolute line numbers must be positive, a relative `+0`/`-0` is refused, and a `/regex/` that ends in a backslash is refused. Matches against the file stay with Git.
- `log` and `show` refuse a negative final count while `--max-count-oldest` is in effect. Git 2.55.0 crashes on it whenever the walk yields a commit and exits normally when the walk is empty; the strict API refuses it either way.
- `diff --cached` (or `--staged`) without revisions refuses a final `--since`/`--after` or `--until`/`--before` date, as it already refused a final `--max-age` or `--min-age` other than `-1`; a later `--max-age=-1` or `--min-age=-1` resets the filter and is accepted. Git prints usage for these, except for a date text that resolves to exactly its default in the local time zone, which the strict API still refuses.
- `diff` refuses a bare `-` before `--`. Inside a repository Git refuses it too; outside a repository Git's implicit no-index mode reads it as standard input, which the strict API offers through the `diff --no-index` scope.
- `diff --git-completion-helper` and `--git-completion-helper-all` are accepted when the option is the only argument, with no other option, `--` or path.
