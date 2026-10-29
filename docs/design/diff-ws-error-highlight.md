# Shared whitespace-error highlighting grammar

The `diff_opt_ws_error_highlight` callback accepts exact comma-delimited `none`, `default`, `all`, `new`, `old`, and `context` tokens. `parse_ws_error_highlight` loops only while text remains and consumes one comma after each token. An empty full value and a single trailing comma are therefore valid; leading/interior empty tokens are invalid. Tokens are case-sensitive and neither ASCII nor Unicode whitespace is trimmed. The option does not support negation.

Unknown tokens fail immediately. Although `none`, `default`, and `all` replace native highlighting bits, `unknown,none` cannot repair an earlier failure. Validation preserves raw text and does not predict configuration-dependent rendering or resulting native bit state. Parser timing, public required-string shapes, and NUL handling remain independent.

The type parser preserves finite value-union failure arms. Dynamic strings, symbolic templates, and the existing 128-step analysis budget remain runtime-owned; this is not complete symbolic or unbounded language recognition. The baseline compares 1,716 native/API invocations across six Git versions, five help frontends, and ordinary no-change diff controls. Thirteen unused rejection assertions establish missing literal constraints. These finite checks do not complete any command audit.
