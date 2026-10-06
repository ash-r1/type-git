# Typed command API and audit workflow

`Git`, `WorktreeRepo`, and `BareRepo` expose `command(name, arguments, executionOptions)` for CLI operations without a parsed convenience method:

```ts
const hash = await git.command('hash-object', [['--stdin']], { stdin: 'hello' });
await repo.command('remote add', [
  ['--mirror', 'fetch'],
  { operand: 'origin' },
  { operand: '/path/to/upstream' },
]);
await repo.command('lfs pointer', [['--check'], ['--stdin']], { stdin: pointer });
```

Option tuples distinguish flag names and values from positional operands. Argument ordering, repetitions, empty values, aliases, and explicit `['--']` are preserved. An operand beginning with a dash needs the separator. Git's parent-only options, such as `remote -v show`, have an explicit insertion position. Native Git boolean flags take no value; use their negated spelling. LFS flags also accept boolean values, including `false`.

A known option name does not imply that its argument contents are fully validated. Git still evaluates repository state, configuration, object names, protocols, and callback-specific argument languages. Execution returns `RawResult`, including nonzero exit status. `stdin` and output currently use strings; binary protocols require further work. `raw()` remains available for commands not yet in the typed catalogue.

Literal tuples are folded in order into normalized state. TypeScript tests each declarative rule separately, avoiding a Cartesian union of every allowed combination. Dynamic arrays retain option-name/value-shape checking and receive combination checking at runtime. JavaScript callers receive the same runtime validation. Both layers use the same generated rule declarations. Help bypasses semantic constraints, while argument syntax remains checked.

## Reproducible sources

The pinned baselines are Git 2.55.0 and Git LFS 3.8.0. Sources and hashes are recorded in `spec/upstream/`. No command is executed during extraction.

```sh
node scripts/import-lfs-options.mjs /path/to/git-lfs-3.8.0
# In the Git source tree, generate its required headers first:
make hook-list.h config-list.h command-list.h
# Back in Type-Git:
python3 scripts/import-git-options.py /path/to/git-2.55.0
pnpm commands:generate
pnpm constraints:generate
```

The Git extractor expands C macros using the recorded compiler target, then reads option tables and enclosing functions. Tables are candidates: shared parser tables, callback semantics, and command dispatch require explicit scope mapping in `spec/git-command-scopes.json`. Manual parsers and platform-specific programs need separate extraction. LFS extraction follows Cobra registrations, aliases, and inherited persistent flags, rejecting unknown registration forms.

Combination and operand rules are stored in `spec/git-command-rules.json`, `spec/lfs-command-rules.json`, and the existing `src/constraints/` model. Each rule identifies upstream evidence. A rule's `guard` states when it applies: for example, interactive `add` returns before normal-mode validation. Negation and repeated-option behavior are encoded before constraints are checked.

`pnpm commands:check` checks both generated TypeScript and exact finite-domain decision-diagram results in `command-exploration.json`. Domain order and variable order are fixed; no random search or timeout changes the result. These are normalized-state over-approximations, including some states that are not reachable from argv. Counts prove properties of that bounded model, not complete discovery of Git's behavior. Operand counts, arbitrary strings, configuration, and version differences are separate obligations.

The [coverage ledger](./command-coverage.md) distinguishes registration in the typed API from completed auditing. The current catalogue is an incremental part of the whole-Git task. Help-output parity alone does not establish semantic coverage. New scopes need source review, independent Git fixtures, compiler cases, and declared remaining work before they can be called complete.

## Native parser state

The native expansion includes `clone`, `status`, `commit`, `fetch`, `push`, `branch`, `checkout`, `switch`, `restore`, `reset`, `tag`, all worktree operations, and stash `apply`, `branch`, `clear`, `drop`, `export`, `import`, `pop`, `push`, `save`, and `store`. Stash's delegated log/diff grammars remain a separate audit.

Parser order is part of the specification, before final combination constraints:

- Reset modes and status formats overwrite the same variable; the last spelling wins.
- Branch `-d` and `-D` occupy separate bits of the same action. `exclusiveGroups` permits both while excluding other actions. `--no-delete` only clears the ordinary bit.
- `PARSE_OPT_CMDMODE` options reject a conflicting mode immediately, even if a later token would restore the original mode. These checks cannot be reduced to a final-state exclusive constraint.
- Checkout's `--conflict` callback can enable implicit merge. `--no-conflict` cancels that implicit merge but preserves explicit `--merge`. Declarative, ordered callback effects retain this distinction.
- Explicit operands before and after `--` are tracked separately. Revision/path ambiguities without a separator still require repository resolution by Git.
- Callback enums can reject values immediately; other value constraints apply to final state. Empty native filenames clear their option; empty string-list entries remain entries.

`src/commands/native.test.ts` compares these cases with independently invoked Git in temporary repositories. Compiler fixtures cover accepted and rejected literals. The decision-diagram tests compare every subset of a small mixed rule system, including action groups, with complete enumeration.

Git boolean parsing includes signed, base-0 integers and unit suffixes. The current Git 2.55 test environment accepts C23 binary literals; older libc implementations may reject that spelling. This is a version/platform boundary, not a claim of identical parsing on every supported Git installation. Arbitrary callback languages, configuration, protocols, binary I/O, and remaining commands are still tracked as incomplete in the coverage ledger.

## Parser termination and inherited options

The config subcommands `get`, `set`, `unset`, `rename-section`, and `remove-section` stop parsing options at the first operand. Option tuples must therefore precede their operands. After that point, `{ operand: '--literal' }` and `{ operand: '--' }` are literal values; adding a separator there would change the command's meaning. `config list` and `config edit` retain ordinary option parsing.

Config type selectors reject a change from one selected type to another immediately. Repeating an equivalent alias is accepted, and `--no-type` explicitly clears the selection before choosing another type. The seven subcommands share source exclusivity and have operation-specific filter/write restrictions. Legacy `config` dispatch remains a separate grammar.

Notes' `--ref` belongs to its parent command and is inserted before the subcommand. Notes message sources may coexist and concatenate; tag/commit exclusivity rules must not be copied to notes. `notes copy` defaults its destination to HEAD when supplied one object, and switches to zero positional objects with `--stdin` or `--for-rewrite`.

`stash create` has no option parser: all words, including `--help` and `--`, are message text represented by operand objects. This is encoded explicitly instead of applying generic help or separator behavior.

## Revision and diff parser composition

`log`, `show`, `diff`, `diff-files`, `diff-index`, and `diff-tree` combine the reviewed groups in `spec/git-option-groups.json` with their command-specific declarations. `diff --no-index` has its own scope because it accepts the diff parser without the revision parser. Manual revision spellings are extracted separately with `python3 scripts/import-revision-options.py /path/to/git-2.55.0`; the candidate inventory records source hashes and deliberately makes no completeness claim.

Options can have `checks` evaluated against the state **before** that token; `$value` denotes its incoming value. Both TypeScript and runtime evaluation fold these checks and effects in order. The deterministic report includes a separate projected finite-domain exploration for each checked transition. These projections enumerate the referenced state variables, not arbitrary argument sequences or upstream execution paths.

This distinction captures `--max-count-oldest` versus `--max-count`, `--skip` and `-n`, asymmetric cherry selection, repeated `--stdin`, XOR-style `--reverse`, and merge-diff mode resets. Output-format bits also retain order: `--name-only -s` succeeds, while `-s --name-only` fails; adding `-p` to the latter clears the suppressed-output bit. Native `--no-no-patch` is an inverse spelling of `--no-patch`, and must not overwrite the separately registered `--patch` option. Git 2.55 filename negation leaves an existing filename unchanged; supplying an empty filename clears it.

Independent fixtures compare ordered pairs and selected longer sequences against Git, including all new command scopes. A nonzero Git exit code alone does not establish an option conflict: missing objects, no changes, differing files, and process signals have different meanings. In particular, the pinned Git 2.55.0 crashes with SIGSEGV for `git log --max-count-oldest=1 -n -1` (also `--max-count-oldest=-1`). These inputs pass its parser; the crash is recorded as an upstream execution defect, excluded from the parser rejection oracle, and is not silently converted into a new Git constraint.

Remaining work includes multi-pass log-specific options, revision end markers and shorthand, configuration-sensitive traversal, repository-dependent operands, additional callback languages and binary I/O. The coverage ledger keeps these scopes partial.

The ordered-pair fixtures target the pinned version. Git 2.25.1 differs: `-s` does not reset the existing name-only bit, `--no-graph` does not undo graph state, and `-G --pickaxe-regex` is accepted. Legacy smoke fixtures still exercise the new basic command calls and no-index grammar; they do not assert 2.55 parser equivalence.

## Reflog defaults and stash argument delegation

All seven explicit reflog operations now have typed scopes. `reflog show` initializes reflog traversal before folding user options, so it permits `--grep-reflog` without an explicit `-g` and rejects a remaining `--graph` or `--reverse`. `CommandSpec.initial` records these defaults in the same data consumed by runtime validation, literal types and finite-domain exploration.

Operation grammars follow the implementation: `reflog exists` requires at least one operand and ignores extras; `write` requires four; `list` requires none; `delete` requires at least one. `drop --all` rejects explicit refs, whereas `expire --all` also processes explicit refs. A lone `--single-worktree` and an empty `drop` are accepted rather than prohibited based on usage text.

`stash show` first separates non-dash words from revision/diff arguments. Its short value options therefore use `attachedValue`, emitting `-Sneedle` instead of `-S needle`; `-u` remains the stash parent option. Git's manually parsed `--default` only accepts a detached value, which must itself start with a dash to stay in that command's revision argument stream. Stash revision operands are limited to one. `stash list` still needs a conditional delegation model: it returns before invoking log if no stash ref exists, and its outer parser consumes separators. It must not simply inherit unconditional log validation.

The manual candidate extractor now recognizes parenthesized string literals, including `--filter` and `--no-filter` (131 candidates). Active object filters require object enumeration; clearing a filter removes that requirement. The shared diff model also records that dirstat callbacks clear the suppressed-output bit.

The older Git 2.25.1 also requires exactly one `reflog exists` operand and does not expose log's object-filter spelling. These version differences are exercised or skipped explicitly in the legacy fixtures; they do not change the pinned 2.55 model.

## Merge and sequencer parser stages

Typed scopes now include `merge`, `rebase`, `cherry-pick`, `revert`, `merge-base`, and `commit-tree`. The argument-token list is available to the abstract model: merge and rebase continuation actions must stand alone, including repetitions and separators. Cherry-pick/revert instead consume their own options first and check the leftovers; repeated `--quit` and some additional settings are accepted.

The generator rejects ambiguous C table identifiers instead of silently keeping the last declaration. Occurrence suffixes (`#1`, `#2`) distinguish cherry-pick and revert's two `cp_extra` declarations. `finalTables` encode the own-option parser's precedence over the shared revision grammar: for example, `-S` signs commits here rather than selecting diff pickaxe. `inheritedOptionMarker` records arguments left for revision parsing without duplicating the shared rule set. Native `parse_opt_strvec` callbacks accumulate entries (including empty strings) and clear them on negation.

Rebase's apply/merge/interactive callbacks reject a backend change immediately. Both forms of keep-empty immediately imply merge. Other backend requirements apply after parsing and include negative reapply-cherry-picks outside keep-base. Reschedule-failed-exec only requires the merge backend; a default merge backend satisfies it even without explicit interactive/exec flags. Queued apply arguments plus ignore-whitespace also depend on whether apply was explicitly selected before postprocessing.

Enum normalization records ASCII case-insensitive callbacks explicitly: rebase accepts `--empty=AsK`, whereas cherry-pick's empty enum is case-sensitive. Cleanup choices are checked against their final value. Mainline parsing mirrors the upstream conversion to a signed 32-bit field before checking positivity; it does not incorrectly impose a positive input bound before the conversion.

Source comparisons and compiler fixtures cover these distinctions, merge-base mode arities and commit-tree's concatenated message sources. Git 2.25.1 rejects CLI strategy settings during sequencer continuation and does not clear accumulated strategy options the same way; legacy fixtures record those differences. Configuration, repositories, deeper value languages and multi-pass edge cases remain in the audit ledger.

## Patch application and native mode identities

`apply` and `am` are registered separately: `am` parses its own enums immediately but delegates options such as `--whitespace` only when it actually applies a patch. For example, `am --quit --whitespace=invalid ignored-file` succeeds when cleaning a stray state directory. Applying unconditional `apply` rules to that command would reject valid Git behavior. Session-dependent arity remains delegated until repository-state predicates are available.

Native command modes identify the value assigned to the shared C variable, not the option spelling. `am --continue --resolved -r` selects one mode three times; `--show-current-patch=raw --show-current-patch=diff` selects two conflicting modes. `modeValue` captures fixed identities and `modeFromValue` captures finite callback values. `command-exploration.json` includes deterministic, exhaustive one-token transition tables for each mode group, separately from final-state counts. They cover the declared mode machine, not arbitrary callback languages, interactions between machines, or upstream completeness.

`apply` checks three-way/reject conflicts, merge-variant prerequisites and immediate whitespace/strip-count callbacks. Later negation can clear final-state conflicts; multiple resolution variants overwrite the same variable. Index operations require a repository when that context is explicitly known. Intent-to-add together with index/cached is accepted because Git ignores the redundant option.

One narrow wrapper exception is recorded: Git 2.55 advertises generated negations for `apply --whitespace` and `--directory`, but those callbacks assert `BUG_ON_OPT_NEG` and terminate with SIGABRT. `--no-whitespace` and `--no-directory` are omitted from the typed API to avoid invoking those assertions. Direct subprocess probes confirmed both failures; raw execution remains available. Path normalization, patch content, binary protocols and version differences remain audit obligations.

## File, reference and object inspection

The catalogue includes `ls-files`, `ls-remote`, `ls-tree`, `for-each-ref`, `show-ref`, `symbolic-ref`, `check-attr`, `check-ignore`, `check-mailmap`, `check-ref-format`, `describe`, `name-rev`, `cherry`, `format-rev`, `count-objects`, `write-tree`, `mktree`, `mktag`, `show-index`, `unpack-file`, `verify-commit`, `verify-tag`, `verify-pack`, `stripspace` and `patch-id`.

- `check-attr` partitions attributes and paths at `--`; `--all` and `--stdin` change those operand requirements. `-z` needs stdin in `check-ignore`, but is also valid for direct path output in `check-attr`.
- `ls-files` checks format conflicts before implicit unmerged/stage propagation. Explicit `--stage` conflicts with `--format`, while `--unmerged` and `-v` remain valid. Ignored output needs an explicit mode and exclude source.
- `for-each-ref --start-after` checks the sort list including its initial `refname` entry. Clearing with `--no-sort` before adding one sort is valid. Stdin contents and format/sort mini-languages remain separate obligations.
- `describe --contains` delegates before dirty/broken operand checks; those checks only apply without contains. `name-rev` ORs deprecated stdin into annotate-stdin after parsing, preserving their independent negations.
- Native ignored operands remain accepted for `write-tree`, `mktree`, `mktag`, `show-index` and `patch-id`. `cherry` with more than three operands falls back to configured upstream and ignores the words. These are source-derived behaviors, not recommended usage.
- `check-ref-format` stops at its first operand and has no `--` separator. Its special branch form accepts exactly the flag and branch operand. Reference syntax and repository expansion remain delegated to Git.

The scopes are partial: signatures and object identities, path/ref/format languages, stream contents, binary transport, configuration, abbreviations and historical-version differences still need evidence. In particular, exposing `show-index` does not make the current string-based stdin API a general binary protocol API.

### Maintenance and storage scopes

The catalogue also includes `gc`, all six maintenance operations, commit-graph
write/verify, five multi-pack-index operations, five refs operations, pack-refs,
fsck/fsck-objects, prune/prune-packed, update-server-info and the stage alias.
Each operation is still marked partial in the coverage ledger: delegated numeric
and date grammars, repository state, abbreviations and stdin protocols require
separate audits. Integer tokens currently use safe JavaScript numbers; Git's
additional numeric spellings, such as MIDX batch-size units, remain pending.

The `includes` predicate reads two state fields: an accumulated array and the
incoming `$value`. Maintenance task callbacks use it before appending the task.
Git 2.55 matches a task name without ASCII case sensitivity, then rejects an
exact repeated spelling. Thus `gc,gc` fails while `gc,GC` succeeds. The callback
stores original spellings (`preserveCase`) and serializes them unchanged.

The solver compiles relational predicates over both variables in sorted order.
Counts and witnesses remain exact over the declared finite domains. Maintenance
transition domains include lowercase and uppercase representatives; they do not
enumerate every mixed-case string or prove completeness of upstream discovery.
Case-insensitive literal arguments are checked by folding the supplied string,
rather than constructing an exponential union of every possible enum spelling.
Dynamic strings and argument arrays remain subject to runtime validation.

### Index and low-level merge scopes

`update-ref`, `checkout-index`, `read-tree`, `merge-file` and `merge-tree` model
native transaction modes, input selection, callback ordering and operand limits.
Notable Git 2.55 behaviors include checkout stage strings beginning with `1`, `2`
or `3` (not just those single digits), up to eight read-tree inputs, and an
exclude-per-directory callback that requires an earlier `-u` token. Merge-file
accepts successive ours/theirs/union selections and case-insensitive algorithm
names, including `default`; its fourth label is rejected immediately.

The array `lengthEquals` predicate expresses merge-tree's implicit mode: three
operands select a trivial merge that forbids every additional original token.
Negated options and even the `--` separator still count. Explicit trivial mode
allows exactly one mode flag and three operands. Stdin merging ignores leftover
operands but excludes a global merge base. These are argument constraints;
conflicts, tree validity and the stdin protocol remain Git's responsibility.

### Object and utility scopes

`cat-file`, `repack`, `replace`, rerere and its six named operations, for-each-repo,
column, fmt-merge-msg, bugreport, diagnose, version and var add native schemas.
Cat-file batch options are single-use callbacks, including repeated identical
options. Explicit `--no-buffer` still requires batch mode. Batch conversion
accepts operands ignored by Git, and `--unordered` is not restricted to batch.
Repack models unreachable-object strategies, geometric/full packing conflicts,
bitmap prerequisites and the write-midx callback. Extra repack, diagnose, version
and non-forget rerere operands remain accepted where Git ignores them.

These scopes remain partial. In particular, column's original first --command
value, delegated filter/format grammars, configuration-dependent restrictions,
numeric spellings and binary output require further work. Raw string output does
not provide a binary archive/object transport contract.

### Protocol and text utilities

The CLI catalogue includes mailinfo, mailsplit, interpret-trailers, url-parse,
hook run/list, credential operations and helpers, checkout--worker, merge helpers
and archive transport helpers. Mail splitting preserves attached short-option
values and its positional output-directory forms. Trailer callbacks accept
ASCII case-insensitive enums, including long names, and `--parse` updates the
three underlying flags; later negation and clearing the trailer list are honored.
Hook arguments require a separator after the hook name. Unknown hook names need
the native opt-in flag. Credential-store ignores unknown operations, while the
root credential command rejects them; credential-cache also ignores extra words.

This adds argument schemas, not typed wire protocols. Tests use synthetic
credentials, isolated files, harmless fixture hooks, and local protocol input.
They never start a credential cache daemon. Binary I/O, platform conditions and
the full delegated protocol grammars remain separate work in the coverage ledger.

### History walking and bundles

Rev-list models its revision sources, notes state, unsupported diff output,
marked object counts and NUL-output conflicts. Its missing-object prescan ignores
unrecognized action strings while retaining the previous recognized action; the
runtime and literal type fold preserve this transition. Shared diff algorithm
callbacks accept ASCII case-insensitive names and the native `default` alias.

Bundle operations parse their own options before the file operand; create's
subsequent revision words are currently represented as operands. History fixup,
reword and split preserve their callback enums and operand counts. Repository
inspection preserves immediate format validation and final info/structure format
restrictions. The ledger remains partial: two-phase revision parsing, ref and
object resolution, interactive history rewriting and nested bundle revision
syntax require further work.
