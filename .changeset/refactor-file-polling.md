---
"type-git": patch
---

refactor: extract shared file polling logic to reduce cognitive complexity

- Created `src/internal/file-polling.ts` shared module with `FilePollingAdapter` interface
- Refactored `tail` and `tailStreaming` methods in Node.js, Bun, and Deno adapters to use the shared polling logic
- Reduced code duplication across runtime adapters by ~70%
- Eliminated 4 cognitive complexity warnings from Biome linter
