---
"type-git": patch
---

Align the typed `pull` command with what Git forwards to `fetch`. Pull consumes its own `--` and passes the repository and refspec words to fetch without one, so a dash-prefixed operand such as `--upload-pack=<cmd>` became a fetch option; the typed API now rejects dash-prefixed `pull` operands even after `--`. The forwarded `--depth`, `--deepen` and `--jobs` values and the deepen/depth/unshallow combinations are now checked as fetch checks them, and a valueless `--jobs`/`-j` is rejected because fetch takes the next forwarded word as its value. These rules are backed by an independent Git 2.55.0 corpus.
