---
"type-git": patch
---

Add dual package support (ESM + CommonJS) using tsup

- Build outputs both `.js` (ESM) and `.cjs` (CommonJS) formats
- Add proper `require` and `import` conditions to package.json exports
- Enable `require('type-git')` for CommonJS projects
- Works with all `moduleResolution` settings (`bundler`, `node16`, `nodenext`)
