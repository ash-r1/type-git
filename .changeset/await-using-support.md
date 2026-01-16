---
"type-git": minor
---

Add `await using` support with `Symbol.asyncDispose` for automatic resource cleanup

- `SpawnHandle` now implements `AsyncDisposable`, allowing automatic process cleanup with `await using`
- `TailHandle` now implements `AsyncDisposable`, allowing automatic file handle cleanup with `await using`
- Added `ESNext.Disposable` to TypeScript lib configuration
- Backward compatible: existing `kill()` and `stop()` methods continue to work as before

Example usage:
```typescript
// Automatic cleanup when scope exits (new)
await using handle = adapter.spawnStreaming({ argv: ['git', 'fetch'] });
for await (const line of handle.stdout) {
  console.log(line);
}
// Process automatically terminated and cleaned up

// Traditional usage still works (existing)
const handle = adapter.spawnStreaming({ argv: ['git', 'fetch'] });
try {
  for await (const line of handle.stdout) {
    console.log(line);
  }
} finally {
  handle.kill();
}
```
