---
"type-git": minor
---

Add rev-parse with comprehensive options support

- Add `revParse()` method to WorktreeRepo and BareRepo
- Support various rev-parse options: `abbrevRef`, `symbolic`, `short`, `verify`, etc.
- Parse output based on option combinations for type-safe results
