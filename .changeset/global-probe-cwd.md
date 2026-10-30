---
"type-git": patch
---

Repository-requiring native probes (such as the `pack-objects --max-pack-size=-0 -h` sign probe used to validate `clone` filters like `blob:limit=-1`) no longer depend on `process.cwd()` when run for repository-less (global) contexts. They now run against a throwaway empty bare repository created in a fresh temp directory, which is removed afterwards, so validation is no longer silently skipped outside a repository and no longer reads an unrelated repository's configuration. `FsAdapter` gains an optional `createTempDirectory()` method, implemented by the Node, Bun and Deno adapters.
