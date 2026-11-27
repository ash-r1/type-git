---
'type-git': patch
---

`git commit` now checks `--author`, `--date` and only mode the same way Git 2.55.0 does. The checks apply in the strict API and in `repo.commit()`:

- An `--author` value containing `>` must split as `Name <email>`. Its name must not be empty or made only of the characters Git strips. For example, `x>` and ` <a@example.test>` are refused. A value without `>` is still looked up by Git among existing authors. The strict API checks this in its types and at runtime.
- `--date` text without a digit must contain a word that Git's approxidate recognizes. That word can be a month prefix of three or more letters, `now`, `today`, `noon`, `yesterday`, `one` to `ten`, `last`, and so on. `friday`, `ja` and `x` are refused, and so is digit-free text with the word `never`, which Git always turns into a time before 1973. A valid `Date` passed to `repo.commit()` is accepted; an invalid `Date` is refused.
- `--only` with `--amend` and a plain (non-`amend:`) fixup now needs paths, a pathspec file or `--allow-empty`. Git 2.32 and later refuse it; it was previously passed through for older Git.

Dry runs and status formats are not checked, because Git returns before reading the author. With these checks, the commit audit is complete.
