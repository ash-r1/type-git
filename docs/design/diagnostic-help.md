# Diagnostic callback help order

Git 2.55.0 `builtin/bugreport.c:cmd_bugreport` and
`builtin/diagnose.c:cmd_diagnose` call `parse_options` with flags zero.
Both use `diagnose.c:option_parse_diagnose`, which accepts exactly `stats`
and `all`. Bugreport's callback value is optional; diagnose's mode is
required and cannot be negated.

Reached `-h`, internal `--help`, and `--help-all` return before later
callbacks and final operand checks. Earlier invalid callback values still
fail even when followed by help or another valid value. A first `--help`
continues to use Git's documentation dispatcher.

The usage-exit profile retains native ignored tail words, including unknown
options. It does not bypass the public tuple shape or argv NUL boundaries.
The two completion-helper spellings are recognized only as a sole parser
word. Per-option arity checks preserve that condition without mixing the
mutually exclusive usage-exit and staged-parser metadata models.

A fresh-main native/public baseline compared 552 cases across six Git
versions. Git 2.25 lacks both commands; those results are separated from
supported-command help behavior. The baseline contains native ignored
missing-value words that remain invalid public tuple shapes; those are
representation controls, not callback-order defects. File snapshots remain
unchanged. New controls compare status, stdout and stderr and assert that
help/completion creates no reports or archives.

All command audits remain partial. Report/archive execution, repository and
configuration behavior, path/suffix handling, abbreviations and broader
version/platform coverage remain independent obligations.
