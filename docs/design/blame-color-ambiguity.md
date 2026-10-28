# Blame color option ambiguity

Git's initial blame option table contains `--color-lines` and `--color-by-age`. Its long-option resolver rejects `--color`, including attached values, as ambiguous before revision-option fallback. This applies to blame, annotate and pickaxe. A native help exit reached earlier ignores the later spelling instead.

The source-audited `rejectedWhenReached` metadata retains the representation vocabulary for ignored tails, but rejects the spelling when parsing actually reaches it. Runtime checking skips this rejection after an exit. Literal type evaluation retains a failed arm with the existing invalid-pass sentinel so a valid flag-union arm cannot hide the failure. Known option shapes and NUL checks remain separate representation boundaries.

Source evidence: Git 2.25.1 and 2.55.0 `builtin/blame.c:cmd_blame`, its color-lines/color-by-age option table and `parse_options_step` before `parse_revision_opt`; `parse-options.c:parse_long_opt`. The finite baseline compares three commands, three option shapes, two help positions and four Git versions (72 cases). It includes exact `--color-lines` as a positive control. No broader abbreviation or platform parity is claimed. All audit scopes remain partial.
