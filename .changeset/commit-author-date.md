---
'type-git': patch
---

`git commit` now checks `--author`, `--date` and only mode the same way Git 2.55.0 does. The checks apply in the strict API and in `repo.commit()`:

- An `--author` value containing `>` must split as `Name <email>`. Its name must not be empty or made only of the characters Git strips. For example, `x>` and ` <a@example.test>` are refused. A value without `>` is still looked up by Git among existing authors. The strict API checks this in its types and at runtime.
- `--date` text without a digit must contain a word that Git's approxidate recognizes. That word can be a month prefix of three or more letters, `now`, `today`, `noon`, `yesterday`, `one` to `ten`, `last`, and so on. `friday`, `ja` and `x` are refused, and so is digit-free text with the word `never` and no number word (`one` to `ten` or `last`), which Git always turns into a time before 1973. With a number word, repeated units can move the year forward, so Git decides. A valid `Date` passed to `repo.commit()` is accepted; an invalid `Date` is refused.
- In the strict API, `--only` with `--amend` and a plain (non-`amend:`) fixup now needs paths, a pathspec file or `--allow-empty`, as in Git 2.32 and later. `repo.commit()` still passes this case to Git, because Git 2.31 and older accept it.

Dry runs and status formats are not checked, because Git returns before reading the author. With these checks, the commit audit is complete.
