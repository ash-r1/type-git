---
"type-git": patch
---

`command()` now accepts optional general-mode options such as `GitCommandExecOpts<GitOutputMode> | undefined` or an optional `GitCommandExecOpts<'bytes'>`, resolving to `RawResult<string | Uint8Array>` instead of failing overload resolution. Literal `{ stdout: 'bytes' }` still yields `RawResult<Uint8Array>` and omitted or text-mode options still yield `RawResult<string>`.
