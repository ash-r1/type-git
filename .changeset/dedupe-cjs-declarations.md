---
"type-git": patch
---

Ship the shared type declaration chunk once instead of as identical ESM and CJS copies (about 5 MB smaller unpacked), and add `require` type conditions to `exports` so CommonJS consumers using `moduleResolution: node16`/`nodenext` resolve the `.d.cts` declarations instead of failing with TS1479.
