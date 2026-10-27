# rev-list sole full usage

A canonical sole `[["--help-all"]]` now reaches the selected native Git executable. Git 2.55 invokes `show_usage_if_asked` before revision parsing; older Git reaches ordinary usage rejection. Exit status and both streams remain native behavior, including repository setup failures outside a repository.

The full-help tuple requires one argument word. Multiword full-help is not an exit from revision parsing, and no parser-exit metadata is added. Only the final input-required rule exempts this sole full-help shape; the flag’s one-word check still runs. All other rules and callback checks remain in place. Existing allowed-value enumerations stay narrow for dynamic public argument arrays; the type fixture checks `--disk-usage` explicitly. Tagged dash operands, flag values, earlier callback errors, and NUL words keep their validation boundaries.

The finite native audit uses twelve shapes, four Linux Git versions, and inside/outside contexts, checking every fixture file hash for mutation. Ordinary controls assert native success for a real HEAD, a maximum of one commit, count output, and object listing. Public tests pin the commit id, count `1`, and a tracked blob listing, and isolate outside directories nested beneath a repository with a parent ceiling. Tagged dash operand controls are representation boundaries, not all product regressions.

Broad traversal, filtering, stdin, bitmap, shallow/partial repositories, configuration, and platform parity remain outside this finite check. All 430 command audit scopes remain partial.
