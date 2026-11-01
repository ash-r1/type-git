---
"type-git": patch
---

`status` and `commit` now reject an empty pathspec (`''`) in the typed command API, matching Git's "empty string is not a valid pathspec" error; `-h` still exits first. `commit --only` without paths or `--pathspec-from-file` is rejected unless `--allow-empty`, `--amend` (without a plain `--fixup`), or an `amend:` fixup applies, matching Git's "No paths with --include/--only does not make sense" error. `repo.commit()` emits no paths, so it now rejects `include: true` without a nonempty `pathspecFromFile` and applies the same `only` requirement.

`repo.commit()` also rejects a `reword:` fixup combined with `include`, `only` or `all`, as Git does. These checks also apply at compile time, so a call whose option types cannot rule out one of these failures (for example `only: someBoolean` without an exemption) is now a type error.
