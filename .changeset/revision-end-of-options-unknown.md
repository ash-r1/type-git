---
"type-git": patch
---

Reject deferred unknown revision/diff options before `--end-of-options` at the type level. Argument lists such as `[{ operand: '--bogus' }, { operand: '--end-of-options' }, { operand: 'HEAD' }]` for `log` used to type-check even though the runtime builder (like Git) rejects them with "Unrecognized revision option". The type-level revision parser now runs the same final usage check when it reaches `--end-of-options`.
