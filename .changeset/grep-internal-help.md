---
"type-git": patch
---

Preserve grep's internal long-help exit before later value callbacks while keeping earlier errors and stop-at-operand parsing. Short `-h` continues to suppress filenames and does not select help.
