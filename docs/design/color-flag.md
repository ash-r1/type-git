The shared `parse_opt_color_flag_cb` callback in Git 2.25.1 and 2.55.0
passes a null configuration variable to `git_config_colorbool`. In this
mode the callback accepts only `always`, `auto` and `never`, ignoring ASCII
letter case. Configuration boolean spellings, numeric booleans, empty
text and surrounding whitespace are not accepted. A bare optional value
uses the source-declared default; negation selects `never`.

The catalogue generator binds that vocabulary by callback identity. This
covers the six pinned C option declarations in branch, tag, for-each-ref,
show-branch, grep and the shared diff table. Existing option groups retain
their vocabulary and state effects. The missing grep vocabulary is now
available to both runtime and literal-type validation.

Validation follows the existing parser phases. Grep's `--help-all` exits
before later callbacks, but cannot hide an earlier invalid color. Its
`-h` flag suppresses filenames and does not exit for help. Difftool keeps
its initial help and tool-help exits before delegated diff callbacks.
Blame, annotate and pickaxe retain their command-specific ambiguous
`--color` spelling. Dynamic values remain runtime-owned. This change does
not predict terminal color output or mark any command audit complete.
