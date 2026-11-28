---
'type-git': minor
---

**Behavior change:** `repo.push()`, `repo.fetch()` and `repo.pull()` now refuse a nonempty `refspec` (or, for pull, a `branch`) without a nonempty `remote`. Git reads the first word after the options as the repository, so before, the refspec or branch was silently used as the remote name. `repo.pull({ all: true, remote })` is refused too, as Git refuses it.

`clone`, `fetch`, `pull` and `push` now match Git 2.55.0 in more places, in the strict API (types and runtime) and in the convenience methods:

- Refspec words must parse as Git refspecs (for example `''`, `main~` and `a:` are refused for push), and a word `tag` must be followed by a tag name whose expanded refspec is valid (`refs/tags/<tag>` for push, `:refs/tags/<tag>` under `--delete`, `refs/tags/<tag>:refs/tags/<tag>` for fetch and pull). Fetch applies this only where it reads refspecs: under `--multiple` every word, `tag` included, names a remote, and `--negotiate-only` reads no refspecs.
- `push --delete` accepts only nonempty valid ref names without `:` (only this check applies under `--delete`, so a name such as `+.topic` is kept as Git keeps it), and push options cannot contain a newline.
- The strict `clone`, `fetch`, `pull` and `push` accept `--help-all`, which Git handles at any position.
- `pull --cleanup` accepts only Git's cleanup modes, and the strict `pull` now accepts `--git-completion-helper` and `--git-completion-helper-all` as a single word and parses its options the way `fetch` does.
- `clone --origin` (and, without it, `clone.defaultRemoteName` passed with `-c`) must be a valid remote name; `clone -c` keys must be valid configuration keys; and a recursive clone cannot use both `--reference` and `--reference-if-able`.

The clone, fetch, pull and push audits now record closures over their Git 2.55.0 sources, checked against independent Git runs.
