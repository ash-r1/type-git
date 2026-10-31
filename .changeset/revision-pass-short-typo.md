---
"type-git": patch
---

Reject single-dash long-option typos such as `-follow` in retained revision arguments at the type level even when the first short character is not a known short option. The runtime parser and native Git already fail with "requires two dashes" before a later completion exit like `--git-completion-helper`, but the type previously deferred the word as unknown and accepted the call.
