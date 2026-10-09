---
"type-git": minor
---

`revParse(ref, { verify: true, quiet: true })` now returns `undefined` when the ref cannot be resolved (for example, a commit that does not exist) instead of throwing a `GitError`. Other failures, such as running outside a repository, still throw. The return type of this overload is `Promise<string | undefined>`.

`quiet` now requires `verify`, matching Git, which only honors `--quiet` in `--verify` mode. Passing `quiet` without `verify` is a type error and throws `GitArgumentError` at runtime.
