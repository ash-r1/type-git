---
'type-git': patch
---

Ship the runtime command catalogue as compact JSON with shared subtrees, decoded on the first typed command call instead of evaluated as an object literal at import time. Each bundle shrinks by about 0.95 MB and importing the package no longer pays for the catalogue unless typed commands are used. Command types are unchanged.
