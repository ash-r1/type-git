---
"type-git": minor
---

`NodeExecAdapter` accepts a `windowsHide` option, also available through `createNodeAdapters({ windowsHide })` and `TypeGit.create({ windowsHide })`, so Git processes no longer open console windows on Windows when it is `true`. Only this vetted option is exposed; arbitrary `child_process.spawn` options such as `shell` are not passed through. The default stays Node's default (`false`).

Add [`docs/adapters.md`](https://github.com/ash-r1/type-git/blob/main/docs/adapters.md), which documents the execution adapter contract: which processes `createGit`, `open` and typed commands start, the working directory each receives (the bare-repository check in `open` runs with no `cwd`), the complete `env` with `inheritEnv: false`, stdin early-close handling, cancellation, and the `CapabilityMissing` error when `spawnBytes` is absent.

**Impact on custom `ExecAdapter` / `FsAdapter` implementations (0.5.0 → 0.6.0):**

- `SpawnOptions.stdin` is now `string | Uint8Array` (was `string`). Adapters that pass it to a string-only API fail type checking and must also write bytes.
- `SpawnResult` is now generic (`SpawnResult<Output = string>`); the default is unchanged.
- `ExecAdapter.spawnBytes` is a new optional method. Without it, `command(..., { stdout: 'bytes' })` throws a `GitError` with kind `CapabilityMissing`; other calls are unaffected.
- `FsAdapter.createTempDirectory` is a new optional method used by repository-requiring probes in repository-less contexts; without it the runner falls back to a path beside a `createTempFile` file. `deleteFile` on a `createTempFile` path is expected to release everything that call allocated.
- Typed `command()` calls may start additional internal probe processes (for example `git <command> -h` or `git init --bare` in a temporary directory). Adapters that only allow specific invocations must accept them; see `docs/adapters.md`.
- Companion programs (new in 0.6.0, for example `gitk`) run in a bare repository context receive the repository directory as `cwd`; plain Git commands in a bare context still receive no `cwd`.
