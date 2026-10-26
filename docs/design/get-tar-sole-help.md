# get-tar-commit-id sole usage words

The inspected Git 2.25 entrypoint requires argc == 1, while newer source also handles sole usage spellings before that check. A canonical or tagged sole -h/--help-all is allowed to retain the selected executable's usage output and exit code. Ordinary input mode still accepts no argument words. First --help remains the global documentation dispatcher.

Command-local metadata uses a distinct sole-help key, exact-one-word option checks and single-word exits. Final argument-word arity is at most one, and tagged operands must all belong to the two usage spellings. Mixed usage/ordinary unions and multiword help calls remain rejected. No shared parser, type algorithm or tar parser is changed.

Native fixtures feed actual git archive --format=tar HEAD bytes to zero-argument native and wrapper calls and verify the fixture commit plus newline inside/outside a repository. Empty/truncated input returns native EOF failure; a zero-filled 1024-byte non-global header returns native status 1. Root entries and index/file/HEAD bytes remain unchanged. These finite SHA-1/archive controls do not establish complete tar record, hash-length, read/write-error or platform/configuration coverage. All command audits remain partial.
