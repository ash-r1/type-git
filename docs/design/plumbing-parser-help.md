# Ordinary plumbing parser help

Git 2.55.0 `builtin/check-ignore.c`, `builtin/check-mailmap.c`, `builtin/verify-pack.c`, `builtin/mktree.c`, `builtin/write-tree.c` and `builtin/prune-packed.c` use ordinary `parse_options` with flags zero and no registered short `-h`. Source-local metadata recognizes `-h`, internal `--help` and `--help-all` at their parser position. First `--help` remains the separate documentation dispatcher.

`parse-options.c:parse_options_step` recognizes each completion helper only when its parser receives a sole word. Reached multiword occurrences are unknown options; earlier help exits before reaching them. The existing runtime and literal machinery implements both cases without a framework change. Git 2.25's unsupported full-completion helper keeps its native error rather than becoming a successful completion.

Final contact/pack/path counts and check-ignore mode conflicts are bypassed by earlier help. Existing final checks still apply without help, and argv shape/NUL checks remain active. Required values and end markers do not acquire help semantics merely because their text looks like help.

Integration tests independently invoke the selected Git and the public API with isolated repository/configuration and empty stdin. The finite audit includes inside/outside repository results on four Linux Git binaries. Every audit command is help, completion or a reached parser error; no tree-writing or object-pruning operation is requested. All six command audits remain partial: repository/configuration failures before parsing, command payload semantics, additional callbacks and platform coverage remain separate obligations.
