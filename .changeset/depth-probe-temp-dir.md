---
"type-git": patch
---

Remove the private temporary directory created by `createTempFile` when the built-in Node.js, Bun, and Deno adapters delete that temp file, so the depth atoi probe no longer leaves an empty `type-git-depth-profile-*` directory behind in the system temp directory on every observation.
