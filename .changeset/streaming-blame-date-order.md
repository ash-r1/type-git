---
"type-git": patch
---

Match native Git's streaming option order for blame, annotate, and pickaxe: reject reached invalid date modes before later help or replacement values, and let earlier help preempt later callback checks. Preserve revision operands and literal paths after `--`.
