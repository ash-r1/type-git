# Execution adapter contract

type-git never spawns processes itself. Every Git (and companion program) invocation goes
through the `ExecAdapter` passed to `createGit({ adapters })`. This page describes what the
built-in runner asks of an adapter, so that a custom adapter (for example one that restricts
which processes may start) knows which calls to accept and how to answer them.

The built-in adapters are `NodeExecAdapter` (`type-git/node`), `BunExecAdapter`
(`type-git/bun`) and `DenoExecAdapter` (`type-git/deno`).

## Methods the runner calls

| Method | Called by the runner | Notes |
| --- | --- | --- |
| `spawn(options, handlers?)` | Yes, for every text-output command and every internal probe | Required. |
| `spawnBytes(options, handlers?)` | Only for `command(..., { stdout: 'bytes' })` | Optional. See [Without `spawnBytes`](#without-spawnbytes). |
| `spawnStreaming(options)` | No | Optional; offered to callers of the adapter only. |
| `getCapabilities()` | No | Required by the interface; informational. |

## `SpawnOptions` as the runner sends them

- `argv`: `[gitBinary, ...]` (or a companion program path). The first element is the program;
  arguments are never passed through a shell. Do not join them into a command line.
- `env`: the **complete** environment for the child. The runner has already resolved the
  inherited variables (see `inheritEnv` on `createGit`/`open`), layered `env`, `home` and
  `pathPrefix` on top, and applied any per-call overrides.
- `inheritEnv`: always `false` from the runner. The adapter must not merge the parent process
  environment underneath `env`; doing so would defeat the environment allowlist.
- `stdin`: `undefined`, a UTF-8 `string`, or a `Uint8Array`. When present, write all of it and
  then close standard input. When absent, the child's standard input should be closed or
  ignored (Node and Bun use `'ignore'`, Deno uses `'null'`). Since 0.6.0 the type is
  `string | Uint8Array`; earlier releases only sent strings.
- `cwd`: see [Working directory](#working-directory).
- `signal`: see [Cancellation](#cancellation).
- `killSignal`: currently never set by the runner, and ignored by the built-in adapters.

## Working directory

Git commands select the repository with an explicit flag. Companion programs (`scalar`,
`gitk`, `gitweb`) take no such flag, so for them the runner selects the repository through
`cwd` instead:

| Context | argv | `cwd` sent to the adapter |
| --- | --- | --- |
| Repository-agnostic (`git.raw`, `git.version`, `clone`, `init`, …) | `git …` | `undefined` |
| Worktree repository | `git -C <workdir> …` | `<workdir>` |
| Bare repository | `git --git-dir <gitDir> …` | `undefined` |
| Companion program, repository-agnostic | `<program> …` | `undefined` |
| Companion program, worktree repository | `<program> …` | `<workdir>` |
| Companion program, bare repository | `<program> …` | `<gitDir>` |

When a credential helper is configured, Git argv starts with
`git -c credential.helper=<helper>` before the context flag.

`undefined` means "do not set one"; the child then inherits the host process's current
directory. For Git commands and companion programs run in a repository context, the runner
passes the path given to `open()` (or `clone`/`init`) unchanged, both in the Git flag and as
`cwd`. Use absolute repository paths: then the selected repository does not depend on the
inherited directory, so an adapter that requires a working directory should not reject these
calls. A relative worktree path is resolved twice (once by `cwd`, again by `-C`) and fails even
with the built-in adapters (#329). Repository-agnostic calls are
different: `git.raw()`, `git.command()` and repository-agnostic companion programs run with
`cwd: undefined`, so a command that needs a repository (for example `git.raw(['status'])`)
resolves it from the host process's current directory, as the Git CLI would. Open a repository
and use `repo.raw()` to avoid that.

## Processes started by common operations

- `createGit()`: `git --version` (repository-agnostic) unless `skipVersionCheck` is set.
  The result is cached per `Git` instance.
- `git.open(path)`, `git.openBare(path)`, `git.openRaw(path)`:
  1. `git -C <path> rev-parse --is-bare-repository` with `cwd: <path>`.
  2. Only if step 1 exits non-zero: `git --git-dir <path> rev-parse --is-bare-repository` with
     no `cwd`. The error thrown when both fail carries step 2's exit code and stderr.

  If `<path>` does not exist, step 1 fails to start (the built-in Node adapter reports
  `spawn git ENOENT` because the working directory is missing) and `open` throws a
  `GitError` with kind `SpawnFailed`; step 2 does not run.
- Typed `command()` calls may start **internal probes** before the real command when the
  result depends on how the installed Git parses an argument (for example `git <command> -h`,
  `git --exec-path`, or a probe inside a throwaway bare repository created with
  `git init --bare --quiet <tempdir>` in a fresh temporary directory). Probes use the same
  `env` overrides and `signal` as the call, but `GIT_TRACE*` variables are removed and audit
  hooks are not notified. Most calls need no probe.
- Typed high-level methods (`status()`, `log()`, …) start the Git command they wrap, and
  sometimes a short query such as `rev-parse`.

## Results and errors

Resolve with `SpawnResult`:

- `exitCode`: the process exit code, or `-1` when unknown (for example, killed by a signal).
- `signal`: the terminating signal name, if any.
- `aborted`: `true` when the process was stopped because `signal` fired.
- `stdout` / `stderr`: the complete output. `stderr` is always text.

A non-zero exit is **not** an adapter error: resolve normally and let the caller decide.
Reject only when the process could not be started or driven (the runner wraps the rejection
in a `GitError` with kind `SpawnFailed`, or `Aborted` if the call's signal had fired).

`handlers.onStderr` is supplied only when progress callbacks or trace hooks need incremental
stderr; call it with each chunk as it arrives. `handlers.onStdout` is not used by the runner.

### Standard input write failures

When Git exits before reading all of standard input, writing fails. The built-in adapters
ignore that early-close error (`EPIPE`, or `EOF` on Windows, in Node; `BrokenPipe` in Deno;
Bun hands the input to `Bun.spawn` and reports no write error) and report Git's own exit
result. In Node and Deno any other stdin error rejects the spawn. A caller that must treat a partially consumed input
as a failure needs to check the exit code and output of the command (or use a custom adapter).

## Cancellation

- If the call's `AbortSignal` is already aborted, the runner returns
  `{ exitCode: -1, aborted: true }` without calling the adapter.
- Otherwise the adapter should stop the child when the signal fires and resolve with
  `aborted: true`. The built-in adapters send `SIGTERM` and remove their abort listener when
  the process closes.

## Without `spawnBytes`

`spawnBytes` is optional. Without it, any call that requests byte output
(`command(..., { stdout: 'bytes' })`) throws a `GitError` with kind `CapabilityMissing`
("The selected execution adapter does not support binary stdout") instead of starting the
command. Text-mode probes may still run before that error, and a call whose `AbortSignal` is
already aborted returns `aborted: true` first. Text-output calls are unaffected.

## `FsAdapter`

The runner and repository methods call these `FsAdapter` methods:

- `exists` / `deleteDirectory`: `clone` and `init` check whether the destination already
  exists, and remove a destination they created if the call is aborted.

- `createTempFile` / `deleteFile`: `deleteFile` on a path returned by `createTempFile` should
  release everything that call allocated (the built-in adapters also remove the private
  directory holding the file).
- `createTempDirectory` (optional, since 0.6.0) / `deleteDirectory`: used for probes that
  need an empty repository. When it is missing, the runner creates a temp file with
  `createTempFile` and uses the sibling path `<file>-repo`, removing both afterward.
  `deleteDirectory` is also called when `git init` failed before creating that directory, so
  it must succeed when the path does not exist (the built-in adapters ignore a missing path).
- `readFile` / `writeFile` (optional): when missing, the probes that need them are skipped and
  the command runs without that extra validation.

`tail` and `tailStreaming` are part of the interface but are not called by the runner.

## Node-specific options

`NodeExecAdapter` accepts a small, vetted set of `child_process.spawn` options:

```ts
import { TypeGit, createNodeAdapters, NodeExecAdapter } from 'type-git/node';

const git = await TypeGit.create({ windowsHide: true });
// or
const adapters = createNodeAdapters({ windowsHide: true });
// or
const exec = new NodeExecAdapter({ windowsHide: true });
```

`windowsHide` hides the console window Windows would otherwise open for each Git process. It
defaults to Node's default (`false`). Options such as `shell` are intentionally not exposed,
because they would let Git arguments be reinterpreted.
