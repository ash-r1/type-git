---
"type-git": minor
---

Reject NUL-containing literal CLI arguments in the typed command API, including values, operands, literal unions, help calls, and dispatched subcommands. These strings cannot be represented in OS argv; dynamic inputs keep runtime validation.
