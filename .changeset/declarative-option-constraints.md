---
"type-git": minor
---

Derive typed option validation from an evidence-backed declarative constraint model. Add deterministic finite-domain exploration, generated clone type cases, and independent Git conformance tests.

Remove overly strict restrictions on Git-supported flag combinations, preserve Git's argument precedence, and add missing clone filter prerequisites and other documented Git constraints. Allow zero parallel jobs and zero deepen values. Forward compatible sequencer control options instead of discarding them.

Some previously accepted invalid combinations now fail earlier, including submodule filtering without its prerequisites, delete pushes without refs, incompatible commit message sources, and orphan worktree options. Every modeled restriction now records whether it comes from Git or a documented typed API exception.

Preserve boolean ls-tree abbreviation, check literal command constraints against normalized option state, and distinguish excess option values from unknown flags.
