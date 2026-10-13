# Constraint work handoff — 2026-10-13

Work is paused for a machine transfer at the user's request. All 430 command audits remain partial; finite native corpora do not establish complete Git constraint coverage.

PRs #129, #132, #133, #134 and #135 have been merged after current-head CI and completed Copilot reviews. The front is #136. PRs #95/#99 remain excluded. Continue the feature chain through #192 in order, applying only each prepared feature delta onto the actual current main before fresh CI/review and squash merging. Preserve the externally released main version and all corrections already merged there.

This branch preserves prepared feature commits through #192 on an older baseline. It is an archive for extracting incremental feature deltas, not a replacement tree for current main. The #192 completion work now records 990 native outcomes across 51 initial parser scopes, valid existing stash/ref context, and source-backed ONE_SHOT revision exits. Unknown retained words await final usage validation; reached callbacks still validate before a later exit. KEEP_UNKNOWN_OPT suppresses long-name abbreviation registration in the delegated diff parser. Runtime validation agrees with all 990 outcomes. All source roots and the three completion compiler shards passed for the prior 930-case revision; the final 990-case compiler check, full contracts and package integration remain pending.

The current #192 work also includes a dedicated runtime regression and exact native long-form metadata. Full source/contract/package validation on actual current main and fresh GitHub CI/reviews are required before promotion or merge. Earlier local validation is recorded in the accompanying handoff ledger, with pending and failed checks kept explicit.

Read the repository handoff branch `checkpoint/sequential-merge-handoff-2026-10-13` and `handoff/sequential-merge-2026-10-13/README.md` for portable state, code archives, helper scripts and resume instructions. No merge-policy changes or release actions are part of the transfer.
