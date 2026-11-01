---
'type-git': patch
---

`repo.command('stash …')` no longer refuses a dash-prefixed message word such as `stash create -no-message` or `stash push -m -no-message`. The legacy Git 2.25 parent-pass probe treated its single-dash typo check as a wrapper error, although newer Git keeps these words as message text and the compile-time types already accepted them.
