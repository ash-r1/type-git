---
'type-git': minor
---

**Behavior change (strict API):** `strict(repo).command()` now checks more of `git diff`, `git log` and `git show` against Git 2.55.0, and the four audit scopes `diff`, `diff --no-index`, `log` and `show` are recorded as complete.

- `log -L` and `show -L` check the `<range>:<file>` syntax as Git does before it reads the repository: a `:` and a file name must follow the range, absolute line numbers must be positive, a relative `+0`/`-0` is refused, and a `/regex/` that ends in a backslash is refused. Matches against the file stay with Git.
- `log` and `show` refuse a negative final count while `--max-count-oldest` is in effect, because Git 2.55.0 crashes on it.
- `diff --cached` (or `--staged`) without revisions refuses `--since` and `--until` (as it already refused `--max-age` and `--min-age`), which Git answers with usage.
- `diff` refuses a bare `-` before `--`, which Git always refuses outside `--no-index`.
- `diff --git-completion-helper` and `--git-completion-helper-all` are accepted as the only word before `--`.
