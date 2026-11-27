---
'type-git': minor
---

**Behavior change:** `repo.branch.create(name, { setUpstreamTo })` now creates the branch and then sets its upstream with a second `git branch --set-upstream-to` command. Before, it passed `--set-upstream-to` to the create command, which Git treats as a separate action: it refused a new name (or a start point) and, for an existing name, only changed its upstream without creating anything. If the second command fails, the branch has already been created (or, with `force`, reset). `setUpstreamTo` together with `recurseSubmodules` is now refused before Git runs.

The strict API now refuses `git branch` with `--verbose` and a final `--column` that explicitly enables columns (for example `--column`, `--column=always`, `--column=row` or `--column=dense`), which Git rejects; `--column=auto` stays with native Git because it depends on the terminal. The branch audit now records a closure over `builtin/branch.c`, checked against independent Git 2.55.0 runs, with the `--format`/`--sort` grammar and branch name syntax left as explicit open items.
