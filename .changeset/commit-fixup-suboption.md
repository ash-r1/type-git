---
'type-git': patch
---

`git commit` checks now match Git 2.55.0 in two more places, in the strict API (types and runtime) and in `repo.commit()`:

- A run of ASCII letters directly before `:` in `--fixup` must be `amend` or `reword`, as Git refuses others (`--fixup=x:HEAD`, `--fixup=Amend:HEAD`); any other text before `:` stays part of the commit name.
- `--reset-author` together with `--amend` and a fixup is refused, since Git refuses it in every repository state.

`repo.commit()` also now refuses `message` together with an `amend:` or `reword:` fixup at runtime. The commit audit now records a closure over `builtin/commit.c`; the `--author` ident and `--date` grammars and one version-dependent only-mode refusal stay open.
