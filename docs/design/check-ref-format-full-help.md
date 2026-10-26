# check-ref-format full usage

A canonical sole `[["--help-all"]]` now reaches selected native Git before refname arity validation. Git 2.55.0 invokes `show_usage_if_asked` before option and refname handling; Git 2.25.1 instead reaches unknown-option usage. The native status and output streams remain unchanged. Existing short-help and first documentation-help behavior is unchanged.

When validation reaches the full-help tuple, it requires exactly one word. Tagged dash-leading operands retain their existing separator representation restrictions. Ordinary refname checks remain native behavior after existing argument validation.

Finite tests compare usage and valid, invalid, normalized, one-level, and branch refnames inside and outside a repository without creating refs. They do not establish complete refname grammar, historical revision expansion, or cross-platform parity. All 430 audit scopes remain partial.
