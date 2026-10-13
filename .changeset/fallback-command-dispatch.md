---
"type-git": minor
---

Model exact first-word subcommand dispatch and the legacy config, implicit stash and default reflog grammars. Apply child constraints only after native dispatch; preserve ignored legacy edit/exists operands and defer repository-dependent stash list parsing.

Preserve the existing façade command overloads, including text and byte output, while adding dispatch-aware argument checking.

Emit declarations before bundling and retain separate full typecheck/prepublish validation to keep catalogue growth from exhausting declaration-bundler memory.
