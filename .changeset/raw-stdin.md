---
"type-git": minor
---

`raw()` on `Git`, `WorktreeRepo` and `BareRepo` accepts a `stdin` option (string or bytes), so data
such as commit messages, object contents or path lists can be sent to Git on standard input instead
of through argv, where a value starting with `-` could be read as an option. Git's stdin is still
closed (empty) when `stdin` is omitted.
