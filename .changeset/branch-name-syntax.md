---
'type-git': patch
---

New branch names are now checked against Git 2.55.0's ref name rules (`check_refname_format` on `refs/heads/<name>`, a leading `-` and the name `HEAD` refused), in the strict API (types and runtime) for `git branch` creation and the `-m`/`-M`/`-c`/`-C` target, and at runtime in `repo.branch.create()` and `repo.branch.rename()`. Names such as `a..b`, `x.lock`, `a b` or `bad/` are refused before Git runs. A name with a leading `@{-N}` or an `@{u}`, `@{upstream}` or `@{push}` mark is rewritten by Git from the repository first and is still passed through.

The checks live in `src/constraints/refname.ts` (`validRefnameFormat`, also with `REFNAME_ALLOW_ONELEVEL`, and `branchNameSyntax`), with the scalar parsers `branch-name` and `refname-onelevel` for other commands that take ref names. This closes the branch-name obligation of the branch audit; the `--format` and `--sort` grammars stay open.
