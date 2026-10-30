---
"type-git": patch
---

Enable code splitting in the bundle so the generated command tables are emitted once per module format in a shared chunk instead of being inlined into every entry point (`type-git`, `type-git/node`, `type-git/bun`, `type-git/deno`). This shrinks the published `dist` from about 69MB to about 25MB without changing the public exports.
