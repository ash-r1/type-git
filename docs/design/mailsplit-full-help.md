# mailsplit full usage

A canonical sole `[["--help-all"]]` now reaches selected native Git before output-directory arity validation. Git 2.55.0 invokes `show_usage_if_asked` before its handwritten option loop; Git 2.25.1 fails with unknown option instead. Native exit status and output streams remain unchanged. Existing short-help and documentation-help behavior remains unchanged.

When validation reaches the full-help tuple, it requires exactly one command word. Other option callbacks, output-directory arity, and tagged dash-leading operand restrictions remain active. Outside controls apply a parent-directory ceiling to native Git and TypeGit, assert discovery failure, and exercise a temporary directory nested under an actual repository.

Finite native comparisons cover sole help plus real bare-mail splitting controls with output-directory, digit-count, and starting-index forms. Each output filename and message content is compared after clearing only isolated fixture output files between invocations. Existing mailbox-prefix runtime tests also remain active. Complete mailbox grammar, maildir behavior, encoding, and cross-platform parity are not claimed. All 430 audit scopes remain partial.
