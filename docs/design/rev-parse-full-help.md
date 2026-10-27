# rev-parse full usage and flag output

The canonical `[["--help-all"]]` shape now reaches selected native Git. Git 2.55 invokes `show_usage_if_asked` before repository setup, whereas older Git treats the word as an ordinary flag and may print it or fail repository discovery. Exit status and both output streams remain native behavior.

In multiword calls `--help-all` is an ordinary flag. It does not bypass earlier or later callbacks. A following `HEAD` still resolves to the real fixture commit, while `--verify --help-all` preserves native missing-revision failure. Unknown option tuples and tagged dash operands retain their representation restrictions. Existing `-h` handling and separate `rev-parse --sq-quote` and `rev-parse --parseopt` scopes are unchanged.

The finite native audit covers twelve shapes, four Linux Git versions, and inside/outside contexts. Repository file hashes remain unchanged. Tagged dash operand controls and a wrongly dispatched `--sq-quote` tuple are representation boundaries, not established product regressions. Public native tests also isolate an outside directory nested under a repository with a parent ceiling, and pin successful revision payloads.

This does not establish complete revision/path/filter/parseopt/stdin, configuration, platform, or arbitrary flag passthrough parity. All 430 command audit scopes remain partial.
