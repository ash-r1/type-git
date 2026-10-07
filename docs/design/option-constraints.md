# Declarative option constraints

Git is the authority for command semantics. Type-git rejects an option combination
in advance only when there is an evidenced Git restriction or a documented wrapper
exception. Contradictory-looking flags are not automatically mutually exclusive:
Git can apply precedence, ignore a flag in a particular context, or return an empty
result. An accepted combination does not guarantee that the command will succeed
in a particular repository.

## Source of truth

`src/constraints/commands.ts` contains the constraints for the 40 currently modelled
`CheckedOptions` command families. Each rule carries a stable ID, its origin
(`git` or `type-git`), a reason, and a version-pinned upstream source or this
wrapper-contract document. The generated [inventory](option-constraint-inventory.md)
lists the actual predicates and evidence, including every wrapper exception.

`src/constraints/model.ts` defines a runtime-independent language:

- `exclusive`: at most one active option in a group.
- `required`: all listed predicates must hold.
- `requires`: a predicate implies all prerequisite predicates.
- `requiresAny`: a predicate implies at least one listed prerequisite.
- `arity`: an operand count must be within its bounds, optionally under a condition.
- `conflicts`: a predicate forbids any of the listed predicates.
- `forbid`: a particular conjunction cannot hold.
- `unsupported`: these fields cannot be supplied through this typed API.
- `value`: a supplied value must belong to a finite set.
- `integer`: runtime validation of safe integer representation.
- `range`: a Git-enforced lower bound, checked at runtime.

Predicates distinguish empty/nonempty operands, blank/nonblank filters, positive numeric or parsed Git LFS byte quantities, an inactive value, an active value (neither omitted nor `false`), a present
value (including `false`), an exact value, and a nonzero value. This matters, for
example, for `merge({ squash: true, ff: false })`, negative forms such as
`rerereAutoupdate: false`, and the no-op `fetch({ deepen: 0 })`.

`Constrained<T, Rules>` derives the TypeScript restriction from this language.
`violations()` interprets the same rules at runtime and returns their evidence.
`validateOptions()` is a thin adapter that raises `GitArgumentError` with the rule
IDs and reasons. There are no command-name branches in the evaluator.

TypeScript `number` cannot express a general safe-integer range. Numeric bounds
remain runtime checks. Likewise, arbitrary string/number equality complements
cannot always be represented precisely by TypeScript; exact-value predicates
should use finite literal domains when compile-time equivalence is required.
Dynamic values must be narrowed sufficiently for the compiler to establish a
prerequisite. Runtime validation still applies to JavaScript callers.

## Deterministic exploration

`src/constraints/explore.ts` uses exhaustive enumeration, with no solver package,
random sampling, environment dependence, or Git process. Its inputs are the
constraint model and **explicit finite domains**. Omitted, false, and true values
are separate states; numeric domains include selected boundary values.

1. Build a hypergraph connecting all keys mentioned by each constraint.
2. Partition it into connected components in lexicographic key order.
3. Enumerate each component's Cartesian product in fixed domain order.
4. Record every assignment and the IDs of every violated rule.

No constraint spans two resulting components. Consequently, the full accepted
assignment set is exactly the Cartesian product of their accepted assignment
sets. Enumerating components avoids multiplying unrelated flags without losing
interactions represented by the model. Worst-case complexity is still exponential
in the largest component; no pairwise-coverage or polynomial-time guarantee is
claimed. Do not use the explorer on unbounded or enormous domains in production.

`src/constraints/decision-diagram.ts` also compiles each rule into a reduced
ordered multi-valued decision diagram. It combines boolean functions with memoized
AND/NOT operations, merges identical residual functions, counts skipped variables
exactly with `bigint`, and finds an accepted assignment and an isolated
counterexample for each non-redundant rule. Variable order is lexicographic and
branch order is the declared domain order. A missing isolated witness means the
rule is masked/redundant within these domains, not that the rule is wrong.

Every modelled public option type now gets a structural finite domain from its
unconstrained declaration. The generator fails on unknown type shapes. Strings,
arrays, objects, dates, functions, literal alternatives, boolean states and selected
numeric boundaries are explicit representatives. `clone` additionally retains its
hand-written 28-component / 113-case exhaustive suite. The generated
[exploration report](constraint-exploration.json) records domains and exact counts;
it does not enumerate arbitrary paths, refs, repository states or all Git versions.
The decision-diagram tests compare every one of 1,024 mixed-rule subsets against
full enumeration, plus a constraint over 80 mutually interacting booleans.

`src/constraints/inputs.ts` separately describes normalized operand constraints.
Pathspec-file versus positional-input validation and LFS conflict-checkout
cardinality use this same interpreter. Public overloads also restrict the latter
to one path; arbitrary array lengths still need runtime checks.

Run:

```sh
pnpm constraints:generate
pnpm constraints:check
pnpm typecheck
pnpm test:ci
```

The generator produces compiler assertions for both accepted and rejected clone
assignments, accepted and isolated rejected witnesses for every other modelled
public option type, and the complete rule inventory. Numeric cases are deliberately
checked according to TypeScript's representational limits. CI's `typecheck`
checks generated-file freshness, that every constraint refers to an existing
public option, and that each modeled command has a public type. Generated files
are committed so changes to accepted/rejected cases are reviewable.

## Independent verification and evidence limits

A model-generated test cannot establish that the model is faithful to Git.
`src/impl/option-constraints.test.ts` therefore constructs Git argv independently
and compares Git exit results, model decisions, and wrapper calls in isolated
local repositories. It exhaustively covers the 18 clone layout assignments and,
where Git supports the option, the 18 submodule-filter assignments. Both accepted
and rejected cases are checked. Additional real-Git tests exercise previously
rejected but valid combinations, including diff output precedence, date aliases,
force-with-lease plus force, zero parallel jobs, and locally ignored shallow
options. Existing CI runs these tests on current and legacy Git, Linux and Windows.

The unit suite compares component decomposition against monolithic exhaustive
enumeration on a small model, checks unsatisfiable domains, distinguishes false
from absence, and requires a witness violating each clone rule independently.

The initial rules cite Git v2.48.0 / Git LFS v3.6.1. The expanded audit and command
inventory use Git v2.55.0 / Git LFS v3.8.0; each rule retains its own evidence version. It is evidence, not a runtime
version gate or proof for all releases. Real-Git tests run the installed version;
feature-specific tests skip only when the option is absent. New Git behavior must
be reviewed and modeled explicitly. Source inspection and documentation review
still discover the constraints; the explorer computes consequences of those
constraints, not previously unknown Git semantics.

Repository-state, configuration, and transport-dependent restrictions remain with
Git unless their preconditions are modeled. For example, local clone ignores
shallow options that a network transport may reject together. Such combinations
must not be banned unconditionally. The same applies to sequencer state and
remote authentication. Specialized `revParse` query selection remains outside the model. The
[command coverage ledger](command-coverage.md) distinguishes inventory, partial
audit and completion. Commands without a convenience API are in scope. Shared
dispatch-table names are candidates until their operation scopes are reviewed.
This is not a claim of whole-Git or whole-library completeness.

## Wrapper exceptions

Exceptions must explain a concrete public contract; avoiding implementation work
or treating unusual combinations as mistakes is not sufficient justification.
The inventory is the explicit list. Current categories are:

- Fixed machine-readable representations: porcelain v2/NUL paths and LFS JSON
  preserve filenames and metadata. Alternative representations need a different
  result contract.
- Unrepresentable results or operands: URL/symbolic-ref output in a ref-list API,
  log decorations/statistics in `Commit[]`, names-only config in key/value entries,
  dry-run commit in a completed-commit result, and multi-remote/no-index operand
  forms not expressed by the current methods. These remain available via `raw()`.
- Editor/terminal protocols: interactive staging, interactive rebase, and commit
  message re-editing require interaction not provided by the typed methods.
- Numeric representation: typed counts use safe integers rather than allowing
  JavaScript NaN, infinity, fractional truncation, or imprecise integers. Negative counts are passed through where Git accepts them (for example log
  limits, skip, and abbreviation lengths). Git-enforced lower bounds are separate
  `git` rules; the safe-integer representation is the wrapper exception.

Git options with precedence are forwarded in a stable, documented argv order,
independent of JavaScript object insertion order: IPv4 before IPv6; fetch tags
before no-tags; status no-renames before find-renames; log since before after and
until before before; commit signing before no-signing; ours before theirs.
Force and force-with-lease are both forwarded so Git determines their interaction.
Diff output flags are forwarded together and Git determines the resulting format;
only the actual Git conflict between name-only and name-status is rejected.

Sequencer helpers forward compatible options with their control flag instead of
silently dropping them. The existing commit operand parameter is ignored for
cherry-pick/revert control calls; pass an empty list for those operations. Merge
control calls retain their no-additional-command-arguments restriction because
Git itself enforces it.

## Extending the model

For a new constraint, record the upstream version and source location, determine
whether it depends on value, state, configuration, or argv order, then express
only the context-independent part. Add independent accepted and rejected Git
fixtures, extend finite domains when relevant, regenerate artifacts, and run the
compiler and runtime checks. Review rule deletions and newly accepted cases as
carefully as new rejections. Do not convert warnings or ignored options into hard
errors without a separate, justified wrapper exception.

## Inventory reproduction and audit completion

Download the version-pinned upstream source trees, then run:

```sh
node scripts/import-command-inventory.mjs /path/to/git-2.55.0 /path/to/git-lfs-3.8.0
pnpm constraints:generate
```

The importer reads source text; it never runs the discovered commands. It records
SHA-256 hashes for consumed source files. Cobra shell completion targets are
operands, not extra subcommands. Arbitrary locally installed `git-*` executables
are outside a fixed upstream inventory; callers can continue to use `raw()`.
An audit can be marked complete only with evidence for option grammar, operand
grammar, combination rules, serialization, independent Git tests and compiler tests.
Generating or passing tests derived from a model cannot promote source-audit coverage.

## Additional convenience API contracts

LFS migration separates positional `refs` from `files` used by `--no-rewrite`.
Requiring `files` to select no-rewrite mode, and rejecting `refs` in that mode,
are wrapper distinctions so the caller cannot accidentally reinterpret a ref as a
filename. Git itself uses one positional argument list. The nonexistent `object`
option is rejected. Import/export no longer inherit info-only flags. Include and
exclude arrays serialize as one comma-separated filter, because repeated Cobra
string options replace previous values. LFS lock verification retains ownership
in the optional `ours` field instead of silently omitting `--verify`.
