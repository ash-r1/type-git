---
"type-git": patch
---

Treat a bare `-` as an operand in the `git svn` argument types, matching the runtime parser. Previously calls such as `git.command('svn', [['-i', 'x'], { operand: 'log' }, { operand: '-' }])` were rejected at compile time even though they run correctly.
