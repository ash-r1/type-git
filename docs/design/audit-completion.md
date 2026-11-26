# When an audit scope is complete

`spec/command-audit.json` records one audit scope per Git command or operation. Until this
criterion existed, a scope could only become `complete` when its free-text `remaining`
field was empty, yet that field also held what had been achieved and what was delegated, and
the ledger rightly says that a finite native corpus does not establish completeness. No
scope could ever reach `complete`.

This document defines `complete` so that it is reachable without treating a finite corpus as
proof of exhaustiveness. `scripts/audit-completion.mjs` is its executable form.

## What "complete" claims

A complete scope claims that **every obligation that the pinned Git source places on the
argv of this scope has been identified and closed**. It does not claim that every argv or
repository state was tried. The claim rests on an enumeration derived from the source, not on
corpus size:

- the refusal sites (`die()`, usage, `error()` and `exit()` calls) of the audited functions are
  extracted mechanically from the pinned source by `scripts/refusal-sites.mjs`. The result is
  recorded in `spec/upstream/git-refusal-sites.json`, which `scripts/verify-upstream.mjs`
  reproduces byte for byte from the source, like the other upstream snapshots;
- `pnpm constraints:check` (CI) compares every closure with that snapshot: each extracted
  site must be named by exactly one obligation, each named site must exist, the source file
  must match a pinned fingerprint, and every same-file function that an audited function
  calls or references (option callbacks appear as bare identifiers in option tables) must be
  audited as well or waived with a reason;
- obligations that have no refusal site of their own (parse-options behavior, value
  languages, operands, configuration and repository state, platform differences) must each
  be addressed by at least one explicit obligation;
- native corpora and compiler tests are evidence that each **modeled** obligation behaves as
  the source says. They witness a mapping; they never stand in for the enumeration.

The claim is relative to the pinned baseline (`spec/upstream/command-inventory.json`,
currently Git 2.55.0). A baseline change reopens every closure.

The extraction is syntactic. It finds every call site in the listed functions, including
sites that argv cannot reach; those are still named, typically as `delegated` with the
runtime input that reaches them. Helpers defined in other files (for example
`parse_pathspec` or `die_if_checked_out`) are not enumerated per command; an audited function
that calls one must address what it refuses through an obligation, and the reviewer of the
closure checks that it does.

## The criterion

A scope is complete when all of the following hold. The state is derived, not asserted:
`pnpm constraints:check` fails when a scope that meets the criterion is still `partial`, or a
`complete` scope has any gap.

1. **Facets.** Every facet in `facets` has evidence. Only `operand-grammar` and
   `combination-rules` may instead be listed in `inapplicableFacets`, with a reason (for
   example, a command that takes no operands).
2. **Closure.** The scope has a `closure` for the pinned baseline. It names its `entry`
   function and the audited `sources` (file to function names). Every same-file function
   that a listed function calls or references is listed too or named in `waived` with a
   reason. Function names are unique within a closure.
3. **Refusal sites.** Every site in the snapshot for the listed functions is named by exactly
   one `refusal` obligation, and every named site is in the snapshot.
4. **Required kinds.** The closure has at least one obligation of each kind `parser`,
   `values`, `operands`, `state` and `platform`, and at least one `modeled` obligation.
5. **Dispositions.** Every obligation is one of:
   - `modeled`: the typed API encodes it; `evidence` lists files under `test/`, `scripts/`,
     `src/` or `docs/` that witness it, and the coverage check fails if one is missing;
   - `delegated`: native Git decides it at runtime from input that the argv alone does not
     determine. `reason` says why and `basis` names that input: `configuration`,
     `repository-state`, `object-resolution`, `filesystem`, `environment`, `terminal`,
     `file-content` or `platform`;
   - `excluded`: outside the claim under one of the declared `completion.exclusions`, which
     also lists the kinds it may cover. A refusal site is never excluded.
   An `open` obligation (with a `reason`) is allowed in a partial scope and is reported as a
   gap.
6. **No unclassified prose.** `remaining` is empty. Narrative that is useful to keep moves to
   `notes`, which the criterion does not read.

## Exclusions

Exclusions are declared once in `completion.exclusions` and are deliberately few:

- `other-git-versions`: behavior of other releases, including the legacy 2.25.1 CI job, is
  covered by regression tests but is not part of the claim.
- `completion-output` (parser obligations only): the option list printed by
  `--git-completion-helper` is a shell completion protocol. Its parser exits stay ordinary
  obligations; only the listing is out of scope.

## Closure record

```json
"closure": {
  "git": "2.55.0",
  "entry": "cmd_status",
  "sources": { "builtin/commit.c": ["cmd_status", "finalize_deferred_config"] },
  "waived": { "status_init_config": "Reads configuration only; see the configuration obligation." },
  "obligations": [
    {
      "id": "long-with-nul",
      "kind": "refusal",
      "sites": ["finalize_deferred_config: options '%s' and '%s' cannot be used together [--long, -z]"],
      "disposition": "modeled",
      "summary": "--long with -z is refused.",
      "evidence": ["test/fixtures/status-closure-corpus.json"]
    },
    {
      "id": "configuration",
      "kind": "state",
      "disposition": "delegated",
      "basis": "configuration",
      "summary": "status.* configuration changes defaults only.",
      "reason": "Configuration is read by native Git at runtime."
    }
  ]
}
```

A site label is `<function>: <diagnostic format>`, followed by the literal format arguments in
brackets when the call has any, so sites that share a format stay distinct. A conditional
message (`die(copy ? _("a") : _("b"))`) yields one site per branch, a non-literal message is
labeled by its expression in angle brackets, and usage calls without a message by the call
name. Calls with the same label in one function are one site; the snapshot keeps every
occurrence with its line.

## Workflow

1. Write or extend the closure in `spec/command-audit.json`.
2. Run `node scripts/import-refusal-sites.mjs <git-2.55.0-source>` to refresh the snapshot.
3. Run `pnpm constraints:check`; it lists uncovered sites, unknown sites and unlisted
   references.
4. Before publishing, run `pnpm commands:upstream-check <git-2.55.0> <git-lfs-3.8.0>
   <cobra-1.10.2>` to reproduce the snapshot from the source.

`pnpm commands:progress` reports `Completion gaps` for every scope, for example
`facet:serialization`, `closure`, `kind:platform`, `open:<id>` or `unclassified-remaining`.
A scope with no gaps is complete.
