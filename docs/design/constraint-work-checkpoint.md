# Constraint work checkpoint — 2026-10-07

Work is paused at the user's request. This branch preserves unfinished completion-exit work; it is not ready to merge. All 430 command audits remain partial. Inventory coverage and finite oracle cases do not establish complete Git constraint coverage.

## Latest draft

This branch is stacked on [#191](https://github.com/ash-r1/type-git/pull/191). It records the two native singleton completion exits for 51 source-recorded initial parser scopes, adds runtime/literal parser handling and generated option shapes, and records an independent 830-outcome native oracle in three compiler shards.

The command generator and initial oracle generation completed. Oracle reproducibility, compiler assertions, runtime comparisons, lint, complete source/contract checks and fresh-package integration have not been validated for this branch. A dedicated runtime regression test and audit evidence remain to be added.

## Earlier draft status

| PR | Status at pause |
| --- | --- |
| [#187](https://github.com/ash-r1/type-git/pull/187) | Focused checks passed; complete contract run interrupted by user request; npm integration pending. |
| [#188](https://github.com/ash-r1/type-git/pull/188) | Focused checks passed; complete contract run interrupted by user request; npm integration pending. |
| [#189](https://github.com/ash-r1/type-git/pull/189) | Focused checks passed; queued complete contract/npm checks canceled before starting. |
| [#190](https://github.com/ash-r1/type-git/pull/190) | Focused checks passed; queued complete contract/npm checks canceled before starting. |
| [#191](https://github.com/ash-r1/type-git/pull/191) | Native oracle reproduction and runtime checks passed. Focused compiler check fails for `refs list --count=-1 -- -h`: shared literal constraints do not enforce numeric `range` rules. Lint has one `useBlockStatements` error in `src/commands/mandatory-subcommand.test.ts`. Builder rerun has 6 passing tests and 5 timeouts. Complete contract/npm checks canceled before starting. |

All local validation and queue processes were stopped. No unfinished run is counted as passing. Resume by fixing the known #191 range/lint issues, finishing this branch's runtime/audit work, and rerunning required validation for each draft before marking it ready.

## Merge order and prerequisites

The constraint stack is [#129](https://github.com/ash-r1/type-git/pull/129) → [#132](https://github.com/ash-r1/type-git/pull/132) → #133 → … → #186, followed by draft #187 → #188 → #189 → #190 → #191 and this branch. PRs #130/#131 are not part of the open stack.

At pause, #129 is blocked: its latest GitHub CI run fails Type Check (`test/types/command-api.ts`, TS2345 and TS2578) and all three Windows Node jobs (Git LFS builder test returns 127 instead of 0). Build/npm jobs are skipped. Historical local passes in its description do not supersede these failures. See [the CI run](https://github.com/ash-r1/type-git/actions/runs/37404684475).

The current CI workflow only runs pull-request CI when the base is `main`. Most downstream PRs currently have only the CodeRabbit status; this is not a full CI pass. After each parent is merged, set or verify the next PR's base as `main`, review its incremental diff, and wait for required CI/review before merging it.

Recommended ancestry-preserving route: enable **Allow merge commits** in repository settings, merge the oldest eligible PR using **Create a merge commit**, retarget its child to `main`, then repeat. Merge commits are currently disabled; squash and rebase merging are enabled. Automatic branch deletion is also enabled, so verify the child's base after each merge. These settings have not been changed.

If squash/rebase policy must remain, restack the remaining child branches onto the new `main` after every parent merge; record the old parent commit before merging, replay only the child's own commits, and propagate updated ancestry through descendants. Simply retargeting after squash/rebase can leave already-merged commits in the next PR. This checkpoint does not perform that history rewrite.

The separate backend stack [#95](https://github.com/ash-r1/type-git/pull/95) → [#99](https://github.com/ash-r1/type-git/pull/99) is independent of this constraint chain. #95 currently has successful CI; #99 still needs CI after retargeting to `main`.

Changesets accumulate in the release PR; complete the intended merge batch before merging that release PR.
