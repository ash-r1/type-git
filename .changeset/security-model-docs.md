---
"type-git": patch
---

Document the security model in the README: what the high-level, strict and raw APIs check, which environment variables are inherited, and that a repository's own configuration and hooks are outside it. The `raw()` JSDoc now says that `argv` is not checked and points untrusted data to `stdin`.
