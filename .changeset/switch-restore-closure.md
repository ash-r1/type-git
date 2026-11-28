---
'type-git': patch
---

`repo.switch()` now passes the branch directly after `-c`, `-C` or `--orphan`. Before, an option such as `quiet` could end up between `-c` and the name, so `repo.switch('feat', { create: true, quiet: true })` ran `git switch -c --quiet feat`.

`git switch` and `git restore` are now checked against Git 2.55.0:

- Strict API (types and runtime): a new branch name from `-c`, `-C` or `--orphan` must pass Git's ref name rules. `--track` or `--no-track` without a creation option needs a start point that leaves a valid branch name after its first `/`, once a leading `refs/` and then `remotes/` are skipped, so `origin/` and `origin/HEAD` are refused while `refs/remotes/origin/feat` derives `feat`. `git restore --source=` with an empty value is refused.
- `repo.switch()`: refuses `conflict` with `force` or `discard`, `detach` or `orphan` with `track`, and `startPoint` without `create` or `forceCreate`. It also checks the name in create modes and the name that `track` derives from the target.
- `repo.restore()`: refuses `ours`/`theirs` with `merge` or `conflict`, and `ignoreUnmerged` with `merge` or `conflict`. It also refuses an empty path list without a `pathspecFromFile`.

The switch and restore audits are recorded as complete.
