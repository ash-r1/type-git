---
"type-git": patch
---

Export `type-git/package.json`, so tools and scripts can read the installed version, for example with `createRequire(import.meta.url)('type-git/package.json').version` or `require('type-git/package.json').version`.
