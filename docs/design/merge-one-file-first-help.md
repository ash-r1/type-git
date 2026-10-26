# merge-one-file first-word help

Both inspected Git 2.25 and 2.55 shell scripts source git-sh-setup. Its exact first raw -h prints usage and exits successfully before repository/worktree setup and the script's seven-argument check. Later -h words do not select that exit. First --help remains Git's documentation dispatcher.

A scoped firstWordExits trait recognizes a canonical one-element tuple or tagged operand only at the beginning. It does not add ordinary parse-options handling. Canonical help is first-only before this exit, with a distinct state key so later help cannot bypass final arity. Ignored tail words still undergo shape and NUL checks. The literal model requires every possible first-word union arm to prove this exit; ordinary calls retain seven tagged operands. No other command declares the new trait.

Finite native fixtures use help, wrong argument counts and a seven-word nonempty-blob vector with unsupported symlink mode. Source rejects that vector before unpacking blobs or updating the index. Both native and wrapper calls retain index/file/HEAD bytes and root entries. Outside-repository controls force native process cwd through the execution adapter, including a normal-call repository failure control. No successful merge, conflicted-index resolution, merge payload or complete platform/configuration grammar is claimed. All command audits remain partial.
