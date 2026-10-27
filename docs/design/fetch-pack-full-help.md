# fetch-pack full usage

A canonical sole `[["--help-all"]]` now reaches selected native Git before destination arity validation. Git 2.55.0 invokes `show_usage_if_asked` before its handwritten option loop; Git 2.25.1 reaches unknown-option usage instead. Native exit status and output streams remain unchanged, including repository setup errors outside a repository. Existing short-help and documentation-help behavior remains unchanged.

When validation reaches the full-help tuple, it requires exactly one command word. Tagged dash-leading operands retain their existing representation restrictions. Other option callbacks and destination arity checks remain active.

Finite ordinary controls use `--diag-url` with local/file and git protocol spellings. Git `connect.c` prints diagnosis and returns before launching transport children or connecting. These tests do not exercise actual fetching, packet negotiation, transfer, remote helper execution, or cross-platform transport behavior. All 430 audit scopes remain partial.

Outside controls set `GIT_CEILING_DIRECTORIES` to the parent of their working directory for both native Git and the TypeGit adapter, and assert that native repository discovery fails. A nested temporary directory under an actual repository exercises the parent-discovery hazard before the ceiling is applied.

The ceiling is a strict ancestor: using the current directory itself is ignored by Git ancestor matching. The nested-parent regression verifies the chosen ceiling prevents discovery.
