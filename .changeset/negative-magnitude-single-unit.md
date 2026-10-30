---
"type-git": patch
---

Reject negative unsigned magnitudes with more than one unit suffix (such as `-0kk` or `blob:limit=-0Kg`) at the type level, matching the runtime parser and Git, which accept at most one `k`/`m`/`g` suffix.
