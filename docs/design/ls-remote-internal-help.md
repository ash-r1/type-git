# ls-remote internal help

Git 2.25 and 2.55 use parse_options with STOP_AT_NON_OPTION. A sole -h requests usage, but multiword -h is the heads option. Later --help and --help-all are internal exits; a first --help belongs to documentation dispatch. Completion shortcuts require a sole parser word unless an earlier full-help exit has already stopped parsing.

The command-local exit definition keeps -h only in the sole-word exits. It does not let multiword heads bypass a reached completion error. Parsing stops at the first operand, so tagged later help-looking words remain literal patterns. Option tuples cannot resume parsing after that boundary. Required upload-pack and server-option values resembling help remain values, and shape/NUL guards stay active after help.

The sort callback is immediate in the observed older source and deferred in newer source. Native invalid-sort failures before help or get-url remain delegated results. The wrapper does not claim a complete sort-field language or infer a timing family from a version number.

Finite native/public API controls use help/completion or get-url placed before a local fixture path. The inspected sources return from get-url before obtaining a transport. No external remote is contacted and no upload-pack program is invoked. Index, tracked file and HEAD-file bytes are checked unchanged after each comparison. These tests do not establish all remote/ref behavior, repository configuration or full platform/version grammar. All command audits remain partial.
