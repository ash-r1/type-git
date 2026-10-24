# Ordered help in four ordinary parsers

Git 2.55.0 `builtin/hash-object.c`, `builtin/rerere.c` and `builtin/merge-file.c` use ordinary `parse_options` flags 0. `builtin/check-attr.c` retains the separator with `PARSE_OPT_KEEP_DASHDASH`. Their internal `-h`, later `--help` and `--help-all` terminate parsing before later callbacks and final operand or mode checks. A first `--help` remains the documentation dispatcher path.

Scope-local metadata reuses ordered parser exits. Reached callbacks remain active: malformed merge-file marker sizes, diff algorithms and a fourth label cannot borrow a later help exit. Required option values that resemble help remain values. Shape and NUL validation remain active after help.

Completion helpers require a sole parser word. An earlier help exit bypasses that check; a reached multiword helper is rejected. Sole helpers preserve the selected executable's output, including unsupported legacy helper errors. These tests cover finite help and callback ordering, not hashing, conflict resolution, merge payloads, attribute evaluation or complete platform grammar.
