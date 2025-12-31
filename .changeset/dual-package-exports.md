---
"type-git": patch
---

Add `require` condition to package.json exports for CommonJS compatibility

This enables projects using `moduleResolution: "bundler"` without `"type": "module"` in their package.json to import type-git correctly.
