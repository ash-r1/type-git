---
"type-git": patch
---

Refuse operand objects that Git would read as options in commands with a native first parser pass. `fetch`, `clone`, `push`, `reset`, `add`, `commit`, `log`, `stash list` and similar commands previously forwarded `{ operand: '--upload-pack=...' }`, `{ operand: '--hard' }` or `{ operand: '--' }` as live options or boundaries; `cherry-pick` and `revert` did so even after `['--']`, which their first parser drops before revision parsing. Such operands now raise the same `["--"]` separator error as other commands, while operands after an honored separator and words before a native help or completion exit are unchanged. The same refusal applies when the runner forwards the original argv after an inconclusive native profile observation, so those fallbacks no longer pass such an operand to Git as an option.
