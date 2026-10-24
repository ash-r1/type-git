# Prune help and expiry ordering

Git 2.55.0 `builtin/prune.c:cmd_prune` calls `parse_options` with flags zero and has no registered short `-h`. Internal `-h`, `--help` and `--help-all` exit at their parser position before later callbacks or pruning work. First `--help` retains the separate Git documentation dispatcher. Scope metadata reuses the existing runtime/type exit machinery.

`--expire` is an expiry-date callback. Its natural-language grammar remains delegated to the selected Git: `--expire=not-a-date --help-all` fails natively with malformed expiration date before help, while the reverse order displays help before reaching the bad date. Literal acceptance of a string does not prove native date validity. The API preserves the original option ordering and raw native result; this change does not introduce an approximate static date grammar.

`parse-options.c:parse_options_step` recognizes completion helpers only as the sole parser word. A reached multiword helper is rejected by the API with a scope-specific arity rule; earlier help exits first. Sole helpers preserve actual selected-Git output, including Git 2.25's unsupported full-completion error. Shape/NUL checks remain active after help.

Integration tests compare native/API exit status, stdout and stderr for short/full help, internal help after dry-run, sole completion, earlier-help completion cases, and both expiry/help orders. Reached multiword cases separately assert native unknown-option failure and API GitArgumentError/rule ID, rather than transcript equality. The finite external matrix includes repack as a separate unresolved control, four Linux Git binaries and inside/outside repository cases. Every callback probe includes recognized help, so it stops at help or an earlier error before maintenance work.

Prune's audit remains partial. No pruning behavior, complete natural-language date grammar, configuration/platform or exhaustive callback coverage is claimed. Repack's version-sensitive immediate/deferred callbacks remain a separate audit obligation and are not changed here.
