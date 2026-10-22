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

A known option name does not imply that its argument contents are fully validated. Git still evaluates repository state, configuration, object names, protocols, and callback-specific argument languages. Execution returns `RawResult`, including nonzero exit status. `stdin` accepts UTF-8 strings or unencoded `Uint8Array` views. Output defaults to decoded text; request `{ stdout: 'bytes' }` for binary protocols such as packs. This returns `RawResult<Uint8Array>` without UTF-8 decoding. All three builtin adapters support binary collection, while custom adapters require `spawnBytes` for this mode. Audit events retain an independent copy of binary data in `stdoutBytes` and leave the text `stdout` empty. When the adapter reports termination by a native signal, `RawResult.signal`, the end audit event, and mapped `GitError.context.signal` retain its name. This is separate from `aborted`, which records cancellation through `AbortSignal`. Native signal termination is classified as `NonZeroExit`; a spawn failure without a process signal retains `SpawnFailed`. `raw()` remains available for commands not yet in the typed catalogue.

```ts
const object = await repo.command('hash-object', [['-w'], ['--stdin']], {
  stdin: new Uint8Array([0, 128, 255]),
});
const pack = await repo.command('pack-objects', [['--stdout']], {
  stdin: `${object.stdout.trim()}\n`,
  stdout: 'bytes',
});
await repo.command('index-pack', [['--stdin']], { stdin: pack.stdout });
await repo.command('unpack-objects', [['-n'], ['--strict']], { stdin: pack.stdout });
```

Argument tuples are inferred from the supplied arguments before validation. Validation results use a non-inference position so checking a tuple does not feed alternative candidates back into argument inference. Finite input alternatives still have to satisfy their native grammar; a valid union arm does not excuse a known-invalid arm.

Literal tuples are folded in order into normalized state. TypeScript tests each declarative rule separately, avoiding a Cartesian union of every allowed combination. Dynamic arrays retain option-name/value-shape checking and receive combination checking at runtime. JavaScript callers receive the same runtime validation. Both layers use the same generated rule declarations. Help bypasses semantic constraints, while argument syntax remains checked.

## Reproducible sources

The pinned baselines are Git 2.55.0 and Git LFS 3.8.0. Sources and hashes are recorded in `spec/upstream/`. No command is executed during extraction.

```sh
node scripts/import-lfs-options.mjs /path/to/git-lfs-3.8.0 /path/to/cobra-1.10.2
# In the Git source tree, generate its required headers first:
make hook-list.h config-list.h command-list.h
# Back in Type-Git:
python3 scripts/import-git-options.py /path/to/git-2.55.0
python3 scripts/import-git-numeric-options.py /path/to/git-2.55.0
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
- Callback enums can reject values immediately; other value constraints apply to final state. Native filename empty/negated updates follow the selected parser profile; empty string-list entries remain entries.

`src/commands/native.test.ts` compares these cases with independently invoked Git in temporary repositories. Compiler fixtures cover accepted and rejected literals. The decision-diagram tests compare every subset of a small mixed rule system, including action groups, with complete enumeration.

Git boolean parsing includes signed, base-0 integers and unit suffixes. The current Git 2.55 test environment accepts C23 binary literals; older libc implementations may reject that spelling. This is a version/platform boundary, not a claim of identical parsing on every supported Git installation. The independent scalar test explicitly verifies that an installed non-C23 parser rejects `0b1` while the recorded default profile accepts it; all other cases continue to be compared normally. A passing cross-platform suite therefore does not establish binary-literal conformance on that native profile. Arbitrary callback languages, configuration, protocols, binary I/O, and remaining commands are still tracked as incomplete in the coverage ledger.

## Parser termination and inherited options

The config subcommands `get`, `set`, `unset`, `rename-section`, and `remove-section` stop parsing options at the first operand. Option tuples must therefore precede their operands. After that point, `{ operand: '--literal' }` and `{ operand: '--' }` are literal values; adding a separator there would change the command's meaning. `config list` and `config edit` retain ordinary option parsing.

Config type selectors reject a change from one selected type to another immediately. Repeating an equivalent alias is accepted, and `--no-type` explicitly clears the selection before choosing another type. The seven subcommands share source exclusivity and have operation-specific filter/write restrictions. Legacy `config` dispatch remains a separate grammar.

Notes' `--ref` belongs to its parent command and is inserted before the subcommand. Notes message sources may coexist and concatenate; tag/commit exclusivity rules must not be copied to notes. `notes copy` defaults its destination to HEAD when supplied one object, and switches to zero positional objects with `--stdin` or `--for-rewrite`.

In the pinned Git 2.55 source, `stash create` has no option parser: all words, including `--help` and `--`, are message text represented by operand objects. This is encoded explicitly instead of applying generic help or separator behavior. Git 2.25 instead runs a parent option pass before dispatch, so an initial `--help` exits with usage; a leading `--` stops that pass and remains part of the message. The legacy test checks both native outcomes. The default typed grammar models Git 2.55 and does not claim identical help handling on that older profile.

## Revision and diff parser composition

`log`, `show`, `diff`, `diff-files`, `diff-index`, and `diff-tree` combine the reviewed groups in `spec/git-option-groups.json` with their command-specific declarations. `diff --no-index` has its own scope because it accepts the diff parser without the revision parser. Manual revision spellings are extracted separately with `python3 scripts/import-revision-options.py /path/to/git-2.55.0`; the candidate inventory records source hashes and deliberately makes no completeness claim.

The revision candidate inventory includes branches that exist only to reject a removed spelling. For example, Git 2.55 accepts bare `--unpacked` and a following revision operand, but `revision.c:handle_revision_opt` explicitly rejects every `--unpacked=<packfile>` value. The reviewed group therefore keeps this option as a flag; the inventory's `value` candidate does not establish a supported value grammar. Native and compiler fixtures cover both outcomes in all six revision-group scopes.

Options can have `checks` evaluated against the state **before** that token; `$value` denotes its incoming value. Both TypeScript and runtime evaluation fold these checks and effects in order. The deterministic report includes a separate projected finite-domain exploration for each checked transition. These projections enumerate the referenced state variables, not arbitrary argument sequences or upstream execution paths.

This distinction captures `--max-count-oldest` versus `--max-count`, `--skip` and `-n`, asymmetric cherry selection, repeated `--stdin`, XOR-style `--reverse`, and merge-diff mode resets. Output-format bits also retain order: `--name-only -s` succeeds, while `-s --name-only` fails; adding `-p` to the latter clears the suppressed-output bit. Native `--no-no-patch` is an inverse spelling of `--no-patch`, and must not overwrite the separately registered `--patch` option. Git 2.55 filename negation leaves an existing filename unchanged; supplying an empty filename clears it.

Independent fixtures compare ordered pairs and selected longer sequences against Git, including all new command scopes. A nonzero Git exit code alone does not establish an option conflict: missing objects, no changes, differing files, and process signals have different meanings. In particular, the pinned Git 2.55.0 crashes with SIGSEGV for `git log --max-count-oldest=1 -n -1` (also `--max-count-oldest=-1`). These inputs pass its parser; the crash is recorded as an upstream execution defect, excluded from the parser rejection oracle, and is not silently converted into a new Git constraint.

Remaining work includes multi-pass log-specific options, revision end markers and shorthand, configuration-sensitive traversal, repository-dependent operands, additional callback languages and binary I/O. The coverage ledger keeps these scopes partial.

The ordered-pair fixtures target the pinned version. Git 2.25.1 differs: `-s` does not reset the existing name-only bit, `--no-graph` does not undo graph state, and `-G --pickaxe-regex` is accepted. Legacy smoke fixtures still exercise the new basic command calls and no-index grammar; they do not assert 2.55 parser equivalence.

## Reflog defaults and stash argument delegation

All seven explicit reflog operations now have typed scopes. `reflog show` initializes reflog traversal before folding user options, so it permits `--grep-reflog` without an explicit `-g` and rejects a remaining `--graph` or `--reverse`. `CommandSpec.initial` records these defaults in the same data consumed by runtime validation, literal types and finite-domain exploration.

Operation grammars follow the implementation: `reflog exists` requires at least one operand and ignores extras; `write` requires four; `list` requires none; `delete` requires at least one. `drop --all` rejects explicit refs, whereas `expire --all` also processes explicit refs. A lone `--single-worktree` and an empty `drop` are accepted rather than prohibited based on usage text.

`stash show` first separates non-dash words from revision/diff arguments. Its short value options therefore use `attachedValue`, emitting `-Sneedle` instead of `-S needle`; `-u` remains the stash parent option. Git's manually parsed `--default` only accepts a detached value, which must itself start with a dash to stay in that command's revision argument stream. Required attached short values preserve a separate empty word. Without initial help, that word becomes an invalid empty stash reference; with initial help, Git exits before resolving it. Valid empty long values such as `--ignore-matching-lines=` remain supported. Stash revision operands are limited to one. `stash list` still needs a conditional delegation model: it returns before invoking log if no stash ref exists, and its outer parser consumes separators. It must not simply inherit unconditional log validation.

The manual candidate extractor now recognizes parenthesized string literals, including `--filter` and `--no-filter` (131 candidates). Active object filters require object enumeration; clearing a filter removes that requirement. The shared diff model also records that dirstat callbacks clear the suppressed-output bit.

The older Git 2.25.1 also requires exactly one `reflog exists` operand and does not expose log's object-filter spelling. These version differences are exercised or skipped explicitly in the legacy fixtures; they do not change the pinned 2.55 model.

## Merge and sequencer parser stages

Typed scopes now include `merge`, `rebase`, `cherry-pick`, `revert`, `merge-base`, and `commit-tree`. The argument-token list is available to the abstract model: merge and rebase continuation actions must stand alone, including repetitions and separators. Cherry-pick/revert instead consume their own options first and check the leftovers; repeated `--quit` and some additional settings are accepted.

The generator rejects ambiguous C table identifiers instead of silently keeping the last declaration. Occurrence suffixes (`#1`, `#2`) distinguish cherry-pick and revert's two `cp_extra` declarations. `finalTables` encode the own-option parser's precedence over the shared revision grammar: for example, `-S` signs commits here rather than selecting diff pickaxe. `inheritedOptionMarker` records arguments left for revision parsing without duplicating the shared rule set. Native `parse_opt_strvec` callbacks accumulate entries (including empty strings) and clear them on negation.

Rebase's apply/merge/interactive callbacks reject a backend change immediately. Both forms of keep-empty immediately imply merge. Other backend requirements apply after parsing and include negative reapply-cherry-picks outside keep-base. Reschedule-failed-exec only requires the merge backend; a default merge backend satisfies it even without explicit interactive/exec flags. Queued apply arguments plus ignore-whitespace also depend on whether apply was explicitly selected before postprocessing.

Enum normalization records ASCII case-insensitive callbacks explicitly: rebase accepts `--empty=AsK`, whereas cherry-pick's empty enum is case-sensitive. Cleanup choices are checked against their final value. Mainline parsing mirrors the upstream conversion to a signed 32-bit field before checking positivity; it does not incorrectly impose a positive input bound before the conversion.

Source comparisons and compiler fixtures cover these distinctions, merge-base mode arities and commit-tree's concatenated message sources. Git 2.25.1 rejects CLI strategy settings during sequencer continuation and does not clear accumulated strategy options the same way; legacy fixtures record those differences. Configuration, repositories, deeper value languages and multi-pass edge cases remain in the audit ledger.

Mainline conversion follows the host C ABI: Git's `strtol` result narrows to an `int` before the positive check. LP64 systems narrow a 64-bit `long`; Windows LLP64 and 32-bit Unix ILP32 saturate a 32-bit `long` first. Runtime architecture selects the native width. The native boundary fixtures verify both installed profiles. Literal mainline validation computes both supported ABI conversions: it rejects values invalid on both and retains the possible normalized values for final constraints. ABI-dependent acceptance remains subject to runtime conversion because declarations cannot infer the executing Git ABI.

Git 2.55 stash pickaxe execution has an upstream argument-lifetime limitation: revision parsing frees removed strvec elements while the pickaxe callback retains a pointer. Linux and Windows Git can abort with `BUG: diffcore-pickaxe.c:…: should have needle under -G or -S` (SIGABRT on Unix, exit 3 on Windows). The fixture recognizes only that exact diagnostic and exit form, retains exact argument serialization and unrelated validation checks, and records the output comparison as skipped when the bug occurs. Successful executions still require equal output. Type-Git continues to pass the valid Git invocation through.

## Patch application and native mode identities

`apply` and `am` are registered separately: `am` parses its own enums immediately but delegates options such as `--whitespace` only when it actually applies a patch. For example, `am --quit --whitespace=invalid ignored-file` succeeds when cleaning a stray state directory. Applying unconditional `apply` rules to that command would reject valid Git behavior. Session-dependent arity remains delegated until repository-state predicates are available.

Native command modes identify the value assigned to the shared C variable, not the option spelling. `am --continue --resolved -r` selects one mode three times; `--show-current-patch=raw --show-current-patch=diff` selects two conflicting modes. `modeValue` captures fixed identities and `modeFromValue` captures finite callback values. `command-exploration.json` includes deterministic, exhaustive one-token transition tables for each mode group, separately from final-state counts. They cover the declared mode machine, not arbitrary callback languages, interactions between machines, or upstream completeness.

`apply` checks three-way/reject conflicts, merge-variant prerequisites and immediate whitespace/strip-count callbacks. Later negation can clear final-state conflicts; multiple resolution variants overwrite the same variable. Index operations require a repository when that context is explicitly known. Intent-to-add together with index/cached is accepted because Git ignores the redundant option.

One narrow wrapper exception is recorded: Git 2.55 advertises generated negations for `apply --whitespace` and `--directory`, but those callbacks assert `BUG_ON_OPT_NEG` and terminate with SIGABRT. `--no-whitespace` and `--no-directory` are omitted from the typed API to avoid invoking those assertions. Direct subprocess probes confirmed both failures; raw execution remains available. Path normalization, patch content, binary protocols and version differences remain audit obligations.

`apply -C` uses Git 2.55's checked unsigned 32-bit parser (0 through 4294967295), including immediate rejection before a later option can replace it. Git 2.25 used unchecked conversion and unsigned narrowing; legacy comparisons record that difference explicitly.

`am` queues apply-option spellings rather than clearing earlier entries. Negated whitespace/directory spellings therefore remain dangerous even if followed by positive settings. The typed wrapper permits them with quit, abort or show-current-patch modes (which return before `run_apply`), and rejects combinations that can reach the aborting apply callbacks. This guard is a documented wrapper exception; it does not impose unconditional apply validation on am or reject safe stray-state cleanup.

## File, reference and object inspection

The catalogue includes `ls-files`, `ls-remote`, `ls-tree`, `for-each-ref`, `show-ref`, `symbolic-ref`, `check-attr`, `check-ignore`, `check-mailmap`, `check-ref-format`, `describe`, `name-rev`, `cherry`, `format-rev`, `count-objects`, `write-tree`, `mktree`, `mktag`, `show-index`, `unpack-file`, `verify-commit`, `verify-tag`, `verify-pack`, `stripspace` and `patch-id`.

- `check-attr` partitions attributes and paths at `--`; `--all` and `--stdin` change those operand requirements. `-z` needs stdin in `check-ignore`, but is also valid for direct path output in `check-attr`.
- `ls-files` checks format conflicts before implicit unmerged/stage propagation. Explicit `--stage` conflicts with `--format`, while `--unmerged` and `-v` remain valid. Ignored output needs an explicit mode and exclude source.
- `for-each-ref --start-after` checks the sort list including its initial `refname` entry. Clearing with `--no-sort` before adding one sort is valid. Stdin contents and format/sort mini-languages remain separate obligations.
- `describe --contains` delegates before dirty/broken operand checks; those checks only apply without contains. `name-rev` ORs deprecated stdin into annotate-stdin after parsing, preserving their independent negations.
- Native ignored operands remain accepted for `write-tree`, `mktree`, `mktag`, `show-index` and `patch-id`. `cherry` with more than three operands falls back to configured upstream and ignores the words. These are source-derived behaviors, not recommended usage.
- `check-ref-format` stops at its first operand and has no `--` separator. Its special branch form accepts exactly the flag and branch operand. Reference syntax and repository expansion remain delegated to Git.

The scopes are partial: signatures and object identities, path/ref/format languages, stream contents, binary transport, configuration, abbreviations and historical-version differences still need evidence. In particular, exposing `show-index` does not make the current string-based stdin API a general binary protocol API.

Abbreviation callbacks also narrow `strtol` to a signed int before applying the minimum length. Runtime validation uses the host C-long width for the pre-narrowing saturation, so Windows/32-bit Unix and LP64 Unix can differ at large safe-integer boundaries. Native describe/long comparisons retain that distinction.

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

Case-insensitive callback checks treat opaque branded strings as dynamic text. Known literal spellings retain ASCII validation and duplicate checks; nonliteral text remains subject to the same runtime callback validation as ordinary `string`.

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
numeric spellings and command-specific archive/batch-object binary protocols
require further work. The shared byte transport and single-object/pack round trip
have runtime contracts; they do not establish every archive or batch protocol.

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

Mailsplit's `-d` and `-f` use decimal `strtol` with no end-pointer or errno
check, followed by storage in a C int. The `prefix-cast` numeric profile preserves
that ordering: `-d4suffix` selects four filename digits, and `-f5suffix` starts
numbering at six. Text with no converted digits gives zero; `-d` then requires
the converted value to be between three and nine. Number and bigint inputs are
serialized in their original JavaScript spelling, including fractional and
scientific number spellings. Runtime checks use the selected executable's C long
width; unknown width observations leave the original command to Git. Literal
checks retain complete width alternatives, stop at a proven overflowing prefix,
and preserve uncertainty in symbolic numeric prefixes. Long zero/whitespace
prefixes do not hide the finite rejected cases covered by the contracts. Budget
exhaustion still defers to runtime. Native tests compare message counts, file
names and contents from one bare email, using a file descriptor for native stdin
to avoid an EPIPE race on early option errors. Controlled 32-bit-long expectations
are model checks; they do not establish native Windows or 32-bit execution.

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

### Commands delegating revision and diff parsing

Backfill rejects explicit merge-diff selections, including `--no-diff-merges`,
and preserves accumulating diff filters even when followed by an empty filter.
Its batch size uses native `size_t` width: negative values fail immediately,
while 64-bit Git accepts values above the unsigned 32-bit maximum. The numeric
API accepts safe JavaScript integers; literal contracts permit values valid on
64-bit targets, and typed command execution queries the selected Git executable with
`version --build-options` for its actual `sizeof-long` and `sizeof-size_t`.
An ABI-independent preflight rejects universally invalid arguments before any process
is spawned and skips probing for arguments valid on all supported widths. Only
ABI-dependent validity triggers a probe. The same execution context and per-call
environment select the probe and command;
no JavaScript host ABI is substituted. Missing or unsupported widths fail explicitly.
This also handles 64-bit Windows where C `long` remains 32-bit. Explicit ABI simulation tests do
not substitute for running a 32-bit Git binary.
Last-modified starts with boundary and combined-diff settings and consumes its
own `-r`, `-t` and `-z` before revision parsing. Its single-positive-commit limit
requires object resolution; it is not approximated by a raw operand count.
Diff-pairs requires NUL input and excludes path/revision operands.

Range-diff resolves one symmetric range, two ranges or three commits before
optional paths. Paths may follow without a separator, so a general three-operand
limit would reject valid Git commands. Replay requires exactly one target mode,
preserves final ref-action selection, and accepts options which Git subsequently
overrides with a warning. Phase-specific defaults and delegated value languages
remain recorded as pending in the ledger.
The generated catalogue declares each command's literal schema separately and
uses explicit type references in the registry. This preserves per-command
inference without exceeding TypeScript's declaration serialization limit as the
catalogue grows.

### Search, attribution, patches and archives

Blame and annotate share native grammar, including the legacy `-- path revision`
form and the bits changed by porcelain negation. Their `-S` reads a revision file,
while `--reverse` enables children traversal; these are distinct from the shared
diff pickaxe and reverse-walk options. Grep consumes options before its first
operand, accepts numeric context tokens such as `-12`, and returns early for a
zero match limit before validating several otherwise conflicting options.

Native number callbacks have an explicit `numericOption` schema. Runtime and
literal type checking recognize decimal-digit tokens only; the original token is
preserved in argv. Numeric states and callback checks participate in deterministic
exploration. Combined short-option tokens and integer-overflow spellings still
require separate audit.

Format-patch preserves its own short-option meanings, single-use output-directory
callback, final subject settings and immediate thread-style validation. Archive
supports numeric compression selections and list/create operand forms. Its outer
parser consumes `--exec` even locally, where Git ignores it; no artificial remote
prerequisite is imposed. Configured compression formats, binary transport and
repository-dependent series validation remain pending in the ledger.

### Revision queries and pull

Pull validates its own rebase and cleanup values before fetching. Fetch input
restrictions apply even with `--dry-run`; merge-only restrictions are not imposed
on a dry run. The actual fetch/merge/rebase sequence, configured defaults and
fetched revisions still require further modeling.

Shortlog accepts case-insensitive author/committer grouping, case-sensitive
trailer/format prefixes and format strings containing `%`. Its wrap callback
validates width and indentation immediately. Show-branch preserves the shared
`--more`/`--list` state, permits simultaneous merge-base and independent flags,
and distinguishes positive extra depth from list mode for reflogs.

Rev-parse models its native query value enums and separate-value options.
`rev-parse --parseopt` and `rev-parse --sq-quote` have distinct argument schemas
because Git dispatches them only as the first command argument. Normal rev-parse
still needs phase-aware modeling of unknown flags, file detection, hidden refs
and resolved revision counts. Pickaxe retains blame grammar; Git 2.55's
whatchanged requires the native `--i-still-use-this` opt-in.

### Submodule frontends and sparse checkouts

Public submodule operations and all registered submodule helper operations have
separate schemas. An explicit frontend allowlist prevents helper-only options
from leaking into the shell interface. Foreach's shell parser rejects `--`, while
the helper accepts it; summary's quiet option is emitted before the operation.
Update forwards strategy flags to the helper in fixed rebase/merge/checkout order.

Git 2.55's shell recognizes `-i` but forwards it unchanged to a helper which does
not recognize that spelling. The model therefore rejects a final `-i`, while
accepting `-i --init`, where the long spelling replaces it before delegation.
`--require-init` satisfies filter initialization even if a later helper
`--no-init` appears. Summary's zero limit exits before checking cached/files.

Sparse-checkout list/init/reapply/disable/clean retain Git's ignored operands.
Set/add preserve stdin precedence, and clean does not impose an unconditional
force flag because `clean.requireForce=false` permits omission. Cone path rules,
submodule repository state, callback languages and nested root dispatch remain
explicitly partial in the coverage ledger. Tests use isolated local repositories
and enable only file transport for fixture submodules.

### Bisect operations and relational constraints

All builtin bisect operations and standard state aliases have schemas. The root
also accepts repository-defined term names. Start validates the final good/bad
term values, so a later alias can replace an invalid earlier name. The abstract
`equalsKey` predicate compares two normalized fields; the decision diagram reads
both variables, and domain construction propagates shared representatives through
related fields to a fixed point. Known equal literals are rejected by TypeScript;
dynamic strings and unions are validated at runtime.

Terms counts argument tokens, including repeated identical flags. Log preserves
ignored arguments, while view/visualize and run retain delegated literal words.
Repository state, revision/path disambiguation and the complete refname language
remain explicit gaps. Deterministic counts describe bounded normalized states,
not all argv sequences or complete upstream discovery.

### Required root dispatch

Bundle, commit-graph, history, hook, maintenance, multi-pack-index, refs and repo
require an operation from their native dispatch tables. Common parent options
such as object-dir can precede it. Subsequent words are delegated literally;
select an operation-specific schema to validate that operation's arguments.
Unlike bisect's custom terms, these dispatchers have a closed operation set.

### Index callback boundaries and export modes

Update-index processes paths between options and requires `--stdin` and
`--index-info` to be last. Callback checks can inspect `$remaining`, a tuple of
subsequent API tokens, at runtime, during literal type evaluation and in bounded
exploration. `--again` and `--unresolve` consume the remaining words literally;
subsequent option-looking words are represented as operand objects. Cacheinfo
uses separate-value serialization for its native comma or legacy forms.

Git 2.55 interprets negative index-version values as requests to print the
current version; positive values must be 2, 3 or 4. Git 2.25 rejects negatives,
so the legacy comparison excludes that changed behavior. Chmod validates each
occurrence immediately. Fast-export validates its signature, reencoding and
anonymization callbacks, preserves native negations and checks final import
filename/anonymization relationships. Streaming inputs, ref/object/index state,
legacy cacheinfo parsing and further revision processing remain pending.

### Pack creation and inspection

Pack-objects distinguishes a single output prefix from stdout transfer, requires
stdout for thin packs, and rejects nonzero transfer size limits. Stdin-pack and
cruft modes exclude the internal revision walker; flags such as all, reflog and
indexed-objects imply that walker. Unpacked and strict promisor exclusion retain
their special stdin-pack behavior. Cruft expiration enables cruft until a later
option clears it. Negative depth/window values are accepted and clamped by Git.

Index-pack has its own manual argument grammar, singleton output/title options,
stdin requirements and verification filename derivation. Unpack-objects consumes
binary stdin without positional filenames. Pack-redundant preserves all-mode's
ignored operands and Git 2.55's explicit obsolete-command acknowledgement.
Tests create local pack fixtures and compare their native parsers. Public byte
stdout/stdin have compiler and shared Node/Bun/Deno runtime contracts, including
a large non-UTF-8 pack round trip and isolated audit data. Full streaming and
remaining numeric callback grammars, configuration/path-walk overrides and
command-specific pack format/content behavior remain pending; these scopes
are not marked complete.

### Transport entrypoints and remote helpers

Upload-pack and receive-pack require a single repository directory and retain
native advertise/stateless option combinations. Send-pack requires a destination;
all and mirror conflict with each other and with explicit refspecs. Fetch-pack
uses its manual parser: options precede the destination, automatic negations and
`--` are not added, and depth strings retain the native permissive conversion.
Remote-ext and remote-fd each accept two literal arguments. Their protocol,
URL/expansion grammars, stdin records and repository/server-dependent behavior
remain pending. Tests advertise local repositories, dry-run sends to isolated
bare fixtures, and request helper capabilities without connecting.

### Merge strategies and tool frontends

When dispatched as a merge, recursive merge aliases require exactly two heads
after `--`; excess bases are accepted with Git's warning rather than capped by
the schema. Strategy flags retain last-selection behavior. Git rewrites a first
`--help` argument to its help command before the manual merge parser runs. That
first-position dispatch is modeled explicitly, including a trailing separator;
later --help remains invalid in the manual merge parser. Complete delegated
help argument/viewer behavior remains an audit obligation. Merge-index preserves its native argument-word
minimum, including a no-work `-o <program>` invocation; its positional prefix
interpretation and index-dependent program calls remain pending.

Difftool's explicit GUI/tool/extcmd choices conflict, but mergetool has no such
blanket restriction. Difftool tool-help returns before deferred diff parsing and
final tool selection checks, so inherited immediate diff callback restrictions
are not imposed on that path. Complete delegated diff phase validation remains
pending. Request-pull accepts interleaved patch selection and ignores words after
the optional end ref; tests resolve only local fixture refs.

Recursive merge aliases recognize `-h` and `--help-all` only as the sole command argument; native usage exits with status 129 on Git 2.25/2.47/2.55 and status 0 on Git 2.56, and is tested by its usage output separately from ordinary command execution. First-position `--help` delegates to the global help dispatcher and can retain trailing arguments. `request-pull` requires nonempty start and URL strings; dynamic URL strings defer their value check to runtime.

First-word `--help` on a primary Git command selects Git's documentation parser before the command's local grammar. The API derives primary scopes from the catalogue's single-word argv and absence of a companion executable; it does not extend this rule to child scopes or standalone Scalar/Gitk/Gitweb. Documentation flags use the help catalogue's shapes, so `commit --help -m` selects a manual without a message value, while ordinary `commit -m` still requires one. Fixed tuples and guaranteed-prefix dynamic arrays switch grammar; prefix-free dynamic arrays must retain their original local option shapes. NUL and malformed tuple rejection apply in both contexts.

The native documentation parser evaluates mode combinations and availability. For example, Git 2.25 ignores the implicit command with listing spellings `--all`/`-a` and `--guides`/`-g`, whereas Git 2.47/2.55/2.56 reject these invocations with exit 129. The API preserves that selected native result rather than claiming every recognized help option succeeds. Native comparisons cover manual and usage selectors on each primary Git scope; this finite help-dispatch evidence does not establish complete subcommand constraint coverage.

Difftool pickaxe `-S` and `-G` values are emitted in the same argv word to preserve option-looking search strings through the frontend. No-index requires at least two paths; additional directory pathspecs are supported by newer Git and depend on filesystem state, so native Git checks that condition. Older Git rejecting the directory pathspec fixture is recorded as an explicit unsupported-feature skip.

Difftool retains every incoming pickaxe pattern for delegated validation: Git 2.55/2.56 reject empty `-S` or `-G` even before a later nonempty value can replace it. Tool-help returns before this delegated phase, so empty patterns remain allowed in that early-return mode and are emitted as separate empty argv words to preserve operand boundaries. Git 2.25/2.47 allow the overwritten empty pattern controls; those older-profile comparisons are recorded as unsupported validation skips. Git 2.47 can abort when an un-replaced empty pickaxe reaches diffcore; that failure is not treated as parser rejection.

### Help and service entrypoints

Help listing modes exclude document operands and manual viewer formats. Explicit
negative aliases/external-commands selectors still require all mode. Viewer
format flags share one final selection, so a negation can clear a prior format.
Daemon distinguishes inetd credentials/listening from service input, requires
paths for strict-paths, and preserves negative max-connections as unlimited.
Its port conversion, full callback values and environment-dependent services
remain pending. Tests use single local upload requests over stdin and open no
listening socket.

Fsmonitor--daemon start/run/stop/status have schemas from the supported-platform
source branch. Native parser and non-running status comparisons run when the
selected executable advertises its IPC options. Missing commands and unsupported
platforms are explicit skips. These checks do not claim complete native lifecycle
validation.

Daemon timeout/init-timeout use checked unsigned 32-bit integers, and max-connections uses checked signed 32-bit integers before later overwrite; negative max-connections remains unlimited. Native Git 2.25 and 2.47 accept overwritten out-of-range controls, which are explicitly recorded as unsupported rejection-profile skips. Fsmonitor supported-branch integer callbacks use signed 32-bit integers, while its thread minimum is checked after parsing and can be satisfied by a later overwrite. Capability probes inspect both stdout and stderr and validate process completion; unsupported platforms and missing executables are explicit skips. A supported native status command returning exit code 1 with `not watching` represents a valid non-running state, not parser rejection.

### Import, HTTP and IMAP entrypoints

Fast-import validates callback ranges immediately, including depth <= 8191 and
cat-blob-fd <= INT_MAX. Declarative numeric ranges now support upper bounds, and
exploration includes representatives around both ends. Arbitrary numeric range
checks remain runtime checks. CLI import-marks options can repeat; the stream's
single-import restriction is not incorrectly applied to the command line.
Import signature modes include the conditional signing modes absent from export.

HTTP fetch distinguishes object/URL input from stdin or pack URL input and
requires index-pack arguments for pack fetches. HTTP push deletion takes one
branch. HTTP backend ignores argv and reads CGI environment. IMAP list and folder
can coexist. Tests use empty/local data and an isolated CGI HEAD request; IMAP
validation stops with missing server configuration, without sending messages.
Full stream protocols, numeric/URL/object-ID grammars, manual option prefixes and
server/configuration-dependent semantics remain pending.

Fast-import depth uses its native immediate upper bound of 8191, and signing callbacks preserve their case-sensitive mode language, including an empty `sign-if-invalid=` key suffix. Compiler checks mirror those boundaries for all literal alternatives; dynamic, opaque and template strings defer to runtime. The installed Git 2.56 accepts a fast-import separator while Git 2.25/2.47/2.55 reject it: the typed API preserves the marker and native Git determines availability. Unsupported native comparisons are explicit skips. HTTP index-pack options may be absent from help text, so capability checks use a controlled parser response with no target objects or network access.

### Native fallback dispatch

`config`, `stash` and `reflog` declare exact first-word dispatch targets. An initial operand such as `{ operand: 'get' }` selects its child schema before any fallback callbacks or rules run. A preceding option or separator stays in the fallback grammar. The generator verifies every target against the catalogue and emits the dispatch map in the exploration report; each branch retains its own finite normalized-state exploration.

Legacy config modes derive implicit get/set/set-all from operand count, preserve immediate command-mode conflicts, and constrain display modifiers, value patterns and write destinations. Legacy `--edit` ignores extra operands, while modern `edit` rejects them. Reflog `exists` similarly ignores extra operands. Implicit stash requires a separator before non-patch paths; explicit `stash push` has its own parsing behavior.

`stash list` returns before delegated log parsing when no stash ref exists. Its current schema therefore accepts literal argument words rather than claiming unconditional log-option validation. Repository-state-dependent delegation and the inherited revision callback phases remain audit gaps. Root scopes and their children are partial, not complete.

The three façade classes retain their existing command overload declarations, including text and byte output. Dispatch type checks expand child option languages only for dispatching command names. Separate declaration emission and bundling control build memory usage without replacing those overloads.

The build emits declarations once with TypeScript and then bundles the emitted files, keeping source checking and declaration bundling in separate phases. Declaration emission uses `--noCheck`; `pnpm typecheck` still performs full source and contract checking, and `prepublishOnly` runs it before publication. Packed ESM/CJS and TypeScript consumer tests cover the final artifacts. Root dispatch type checks retain direct schema lookup to avoid distributive expansion across every command during inference.

Root dispatch preserves actual selected Git ABI widths and routes byte/text output through the current execution path. Dynamic, opaque and template first words defer to runtime dispatch. For finite literal unions, type checking collects invalid dispatch and fallback alternatives before accepting the tuple: every alternative must satisfy its corresponding grammar. ABI plumbing is tested with a synthetic registry route to the existing shortlog scalar parser, not presented as native support for a synthetic command. Package declarations are emitted separately without a second source checker; source and compiler-contract checks are required independently, and npm ESM/CJS/TypeScript consumers are verified.

### Standalone upstream programs

`scalar`, its ten operations, `gitk` and `gitweb` use explicit executable metadata. They run their own programs rather than inserting the name after `git`. Configure their locations with `companionBinaries: { scalar, gitk, gitweb }` in the Git constructor; defaults are `scalar`, `gitk` and `gitweb.cgi` on PATH. A custom `gitBinary` still selects Git itself; companions select their child Git processes according to their own native behavior.

The shared runner preserves environment inheritance, HOME, PATH prefixes, credential overrides, standard input, abort signals and audit events. Worktree and bare repository handles supply the child working directory without changing the parent process directory. Raw Git execution retains its existing behavior.

Scalar schemas preserve operation arities, its fixed run-task vocabulary, and the fact that reconfigure's maintenance mode is validated only in the `--all` branch, after option replacement. Parent `-C` and `-c` tuples on an operation scope are serialized before its command word. Root Scalar dispatch also consumes these native global options before selecting the child grammar; repeated prefixes preserve order, and every finite operation-name alternative must satisfy its child constraints. Gitk's own select/argument-command options are typed; delegated revision words remain literal operands. Gitweb's FastCGI selectors and process count are typed without inventing range restrictions. GUI execution, missing CGI/FCGI dependencies, configuration-dependent behavior and remaining delegated grammars are explicit audit gaps.

Companion credential overrides append a quoted `credential.helper=value` to the native `GIT_CONFIG_PARAMETERS` protocol without rewriting `GIT_CONFIG_COUNT`. Whole-parameter quoting preserves compatibility with Git 2.25 and later, including apostrophes, exclamation marks, Unicode and newlines. Native environment-parser diagnostics remain visible. Byte output follows the same explicit adapter path as typed Git commands; Node process transport tests establish byte preservation without claiming GUI or CGI lifecycle coverage.

Scalar maintenance-mode comparisons require the selected executable to advertise `--maintenance`. Scalar 2.47 lacks that option; this case is explicitly skipped rather than counted as a callback rejection or a successful comparison. Option availability remains native-dependent.

The shared Node/Bun/Deno repository contract configures the companion program to actual Git and checks offset binary stdin, large non-UTF-8 byte output in worktree and bare contexts, and global byte output. These checks validate the configured-program transport and cwd behavior; they do not claim native gitk GUI or gitweb CGI/FastCGI execution.

gitk adds `DISPLAY` and `XAUTHORITY` to its default allowlist-based inheritance, as required by [X11 display and authorization configuration](https://xorg.freedesktop.org/releases/X11R6.8.2/doc/startx.1.html). Explicit `inheritEnv: false`, predicates and allowlist removals remain authoritative, and configured/per-call environment overrides retain precedence. Git, Scalar and gitweb retain their existing defaults. Routing tests verify the environment supplied to the process adapter; native GUI launch remains pending.

### Shell frontends and libraries

Filter-branch's long option values remain separate argv words; prune-empty conflicts even with an empty explicit commit filter. Quiltimport accepts trailing words after its parseopt phase. Instaweb action selectors replace each other, and every positional action word must belong to its shell cases. The shared `elements` constraint checks array membership in a finite vocabulary in both runtime and TypeScript; the decision diagram explores deterministic representatives including mixed valid/invalid arrays.

Git-shell supports interactive mode, one `-c` command string, or its single `cvs server` compatibility word. Custom commands under `git-shell-commands` mean its command language cannot be restricted to the three built-in Git services.

Git installs `git-sh-i18n` and `git-sh-setup` as libraries for sourcing by other shell scripts. The tested Linux installations for Git 2.25/2.47/2.55/2.56 use mode 0644; other platform permissions are not inferred from that observation. Their standalone typed command API is marked inapplicable rather than generating invalid `git sh-i18n`/`git sh-setup` invocations. Their setup and function semantics remain subject to audit through callers; native tests source the installed libraries in isolated child shells.

The `value` and `elements` rules retain separate discriminated-union members. Element type checks reject any known invalid finite alternative or known object element; dynamic, opaque and template scalar values defer to runtime validation. This does not weaken existing numeric bounds, requires-any alternatives, or option-value predicates. Native negative comparisons assert terminal status and parser diagnostics, and library sourcing must complete successfully before its marker is printed.

Native shell/instaweb comparisons first check the selected executable. The tested Git for Windows installation omits these frontends; only an explicit command-not-installed diagnostic triggers a skip, which is not counted as successful argument validation. Other probe errors, signals or unexpected responses remain failures.

Git-shell accepts the first `--help` through Git’s global documentation dispatch, including ignored extra subject words. A later `--help` is not that dispatcher, and `-h` is not substituted for it. Native tests configure a child Node man viewer and observe its marker; this proves native dispatch without claiming a rendered system manual. Further help-tail options and historical-version differences remain part of the global-help audit.

The tested Git for Windows installation also rejects `shell --help` because the shell command is not installed. Its native documentation comparison is skipped on the same verified missing-command diagnostic; successful documentation dispatch is established on the available Linux profiles, not inferred for Windows.

Filter-branch’s leading `-h` is handled by its sourced git-sh-setup library and prints usage with status 0 on all four tested profiles. Leading `--help` uses Git’s documentation dispatcher. Both help forms are limited to the first argument; a late help flag is rejected by the native filter-branch parser and cannot suppress conflict checks.

### Arch and CVS frontends

Archimport's implemented Getopt string omits `-o` despite its usage text advertising it. CVS import takes at most one module and accumulates `-M` values; its numeric-looking values remain strings. CVS export consumes the final two operands without rejecting earlier words. CVS server requires explicit export roots before environment fallback, while version exits before that check. These rules follow the source parser, not a reconstruction from usage text.

Native tests stop at parser or local checkout validation boundaries without contacting Arch/CVS services. CVS server is explicitly skipped when its DBI dependency is unavailable. Service protocols, configuration-derived requirements and remaining parser languages are still pending.

Foreign-frontend comparisons require a terminal, non-signalled probe. Only explicit missing-command or missing-Perl-module diagnostics trigger skips; other failures remain test errors. An isolated local DBI installation enables actual CVS server version/export-root validation without changing the library’s default environment policy. Program-reported identity is recorded separately: the tested Git 2.47 executable finds a CVS server frontend reporting 2.56, so it is not evidence for a 2.47 frontend parser. Local checkout rejection and server stdin EOF do not establish export or service-protocol success.

### Send-email phases

The identity pass precedes alias inspection, which rejects ordinary send options and remaining words. Main options are then parsed before final suppression and confirmation checks. Confirmation accepts native prefixes such as `never-trailing`; an earlier invalid value can be replaced before that check. Completion output returns before final suppression validation. The schemas preserve those phases and keep configuration-supplied dependencies open: a CLI relogin delay can obtain its batch size from config.

Tests inspect aliases or use `--dry-run` on locally generated patches. They do not deliver messages. Address/message validation, encoding, transport state and format-patch delegation remain pending.

The suppression-field regexp uses Perl’s `$` anchor. It accepts an exact field or that field followed by one final newline; CRLF and two final newlines are rejected. The schema preserves the string rather than trimming it: Git stores the newline-bearing key separately, so accepting it does not imply the ordinary field’s suppression semantics. Native dry-run comparisons cover all nine newline-bearing field names and both rejected controls.

The inherited library `integer` option representation currently requires safe JavaScript integers; this is not a native Perl/Getopt limit. Native dry-runs accept `--batch-size=9007199254740992` on the tested 2.25/2.55/2.56 frontends. Further integer lexical/large-number handling and completion’s early return before main-parser error handling remain audit work.

### GUI operation schemas

GUI frontend syntax is independently versioned from the Git executable. The old path-loop parser can ignore trailing words after finding a path, while the newer positional parser bounds browser/blame word counts and requires separators immediately before the final path. The library does not infer that dialect from the Git version.

GUI arguments are serialized in their original order and validated as raw words, rather than treating API operand/option tags as native classifications. Only the first `--trace` word is removed. The final browser/blame word is a path, even when it looks like `--line=2`; negative line-looking words can be revisions rather than line options. Source fingerprints identify the complete pinned operation-parser blocks. Runtime checks use the selected executable’s exec-path, retain the filesystem through `withOptions`, and require its frontend version to match the source prelude. Unknown or inaccessible sources defer dialect-specific checks to native Git.

Ordinary typed calls cannot assume a selected frontend. `CheckedCommandArguments` accepts an optional grammar context for explicit model checks; unknown profiles keep the old path-loop alternatives open. Interpreter-dependent Unicode digit recognition remains deferred. Shared syntax, version preludes, source selection, IO preflight and the observed old/new disagreements have tests; discovery, object/path checks, full UI operations and remaining parser cases are still partial audit work.

Native X11 comparisons use an isolated Xvfb with actual Tcl/Tk and message catalogs. The legacy window experiment demonstrated browser/viewer entry for inputs rejected by the newer frontend; X errors caused by closing those windows are not successful command exits or argument rejections.

Git for Windows installs a separate wrapper that invokes `wish` and sources `git-gui.tcl` directly. That verified launcher does not execute the Unix shell’s version prelude. Source selection identifies the pinned wrapper without launching a potentially modal version query; its `--working-dir` preprocessing is handled separately. Native shell-version comparisons are explicitly skipped for that verified missing prelude, rather than treating a timeout as success or argument rejection.

The legacy browser line-selector check is filesystem-dependent: an existing `--line=2` directory wins path detection before the regexp. Actual native comparisons returned usage/exit 1 without that path and opened the browser with normal Ctrl-Q exit 0 when the tracked directory existed. Unknown path existence cannot justify an unconditional browser line-selector rejection.

### Perforce operation extraction

`scripts/extract-p4-options.py` reads the pinned upstream Python AST without executing git-p4, including its command registry, class inheritance and optparse declarations. The checked-in snapshot contains the source hash. Run it with the upstream source directory and `--check` to reproduce the extraction. Runtime and TypeScript schemas are generated from that snapshot plus reviewed operation rules.

Submit and commit accept at most one branch, unshelve requires one changelist, and clone requires depot input. Keep-path needs a nonempty explicit destination before positional destination inference. Choices fail during parsing; every accumulated update-shelve number must be positive after parsing. The shared `eachInteger` constraint checks these arrays at runtime and in deterministic decision diagrams; arbitrary numeric range proofs remain outside TypeScript's literal checks.

Native tests use help, empty local branch listings and parser/local failures with constructor-only Perforce capability probes served by a local fail-closed stub. Perforce/configuration-dependent synchronization and submission, depot languages, exclusion normalization, and option abbreviation remain audit gaps.

P4 optparse integer options accept numbers, raw strings and bigint values without imposing JavaScript safe-integer limits. Raw spelling is preserved. ASCII radix selection, signs, whitespace and underscores follow Python optparse before later help handling; update-shelve positivity compares the parsed integers without narrowing. Non-ASCII integer spellings defer to the selected Python interpreter, whose Unicode tables are independent of JavaScript. Literal proofs for the full Python integer language, interpreter-specific digit limits and older Python differences remain audit work.

### Subversion operation extraction

`scripts/extract-svn-options.py` extracts the pinned git-svn registry, shared option hashes and final global declarations without loading upstream Perl code. The snapshot records source version/hash and declarations. There are 25 registered operations plus the root scope. Global `id|i=s` overrides dcommit's short interactive alias; mixedCase configuration-only fields are removed before CLI parsing. Log and blame allow delegated words as literal operands.

Rules preserve required names/property values, fetch/info operand limits, ignored surplus words, and explicit message/file and initialization-metadata conflicts. Find-rev accepts before and after together (before wins). `svn.*` configuration can supply operation inputs, including revision and layout: the CLI schema deliberately does not require those options to appear in argv.

Native SVN tests cover every operation help grammar and isolated file:// repository workflows, including configuration-supplied revision. Each help operation and each local workflow has a separate test so older Git startup costs do not accumulate under one deadline. Tests explicitly skip when SVN Perl bindings are unavailable; local repository fixtures additionally require the SVN client and svnadmin. Schema/compiler checks remain separate evidence. The root scope scans emitted words for the first registered command before Getopt::Long consumes values. A detached short value can therefore select the command: `-i fetch init` selects fetch, leaving `-i init` for option parsing. Long equals forms such as `--id=fetch` remain one word and cannot select fetch. A preceding literal `help` exits before ordinary option parsing. The preliminary serialization accepts every child option shape for a shared spelling; for example, clone uses `--m` as a flag while branch requires a message value. Global declarations retain priority. Only after selecting the command does its own option table validate the supplied shape and value. Validation removes the selected command word but execution retains the original emitted argv order. Tests compare both late operand selection and short-value selection through the public API against native Git. Delegated log/blame grammars, unrecognized reconstruction cases, config/remote state and value languages remain incomplete.

SVN integer options follow Getopt::Long rather than Python optparse: decimal ASCII digits permit underscores and one final LF, and GNU long-equals empty values become zero. Raw strings and bigint values preserve width without a JavaScript safe-integer gate. Known finite integer literals are checked up to 192 characters; dynamic/opaque and longer values defer to runtime instead of introducing a compiler-size Git restriction. Perl numeric coercion and interpreter-specific behavior remain native; further template proofs and callback phases remain audit work.

Known forbidden ASCII characters in integer templates are rejected even when other sections are dynamic: letter, punctuation and whitespace templates such as `x${string}`, `${number}x`, `.${string}` and `${number} ${string}` cannot match Getopt::Long PAT_INT. The character set is the complement of its admitted ASCII characters; sign placement and the final LF retain their separate checks. Opaque input remains a runtime input, and a union containing a known invalid literal remains rejected. The native regex and corresponding Git comparisons are the evidence for these type checks; other template proofs remain audit work.

### Inventory coverage and reproducibility gates

The pinned inventory now has a typed CLI scope for every executable entry. `sh-i18n` and `sh-setup` are explicitly excluded as sourced shell libraries. The coverage check fails for missing inventory/audit/schema records and rejects other sourced-library exclusions. `command-coverage.json` separates inventory/API counts from completed constraint audits: zero scopes currently claim full constraint completeness.

To verify the upstream evidence without modifying tracked snapshots:

```sh
pnpm commands:upstream-check /path/to/git-2.55.0 /path/to/git-lfs-3.8.0 /path/to/cobra-1.10.2
# Also reproduce expanded C tables on their recorded compiler/target profile:
pnpm commands:upstream-check /path/to/git-2.55.0 /path/to/git-lfs-3.8.0 /path/to/cobra-1.10.2 --c-tables
pnpm typecheck
```

The verifier checks all recorded source fingerprints and reruns extractors in an isolated temporary directory, comparing artifacts byte for byte. C preprocessing is conditional on its recorded compiler version, flags and target; identical Git versions alone do not promise identical platform-specific option tables. Source extraction discovers declarations/candidates, reviewed schemas express semantic rules, and the solver exhaustively traverses their finite normalized domains. None of those counts proves coverage of every argument sequence or repository/configuration state.

For the optional native frontends on Debian, install `python3 subversion libsvn-perl libdbi-perl libcgi-pm-perl tcl tk xvfb xauth`; run `xvfb-run -a pnpm test:ci` to include X11 parser checks. Tests use disposable local repositories and skip unavailable native capabilities explicitly.


### Synthesized LFS completion helpers

Git LFS's pinned Cobra 1.10.2 dependency installs `__complete` and its `__completeNoDesc` alias dynamically. These do not appear in the LFS command registration loop. Inventory and option extraction now read the dependency's actual registration and record both its source fingerprint and LFS's go.mod dependency pin. Upstream reproduction therefore also takes the Cobra source directory.

The helpers require at least one literal argument, including an empty completion fragment. They disable flag parsing: `--help` and `--` are completion inputs, not helper options. Completion diagnostics use the protocol's returned directive and need not produce a nonzero process status. Schema rules do not confuse incomplete/unknown words with invalid helper invocation.

## Object-filter grammar and parser history

The shared `object-filter` scalar parser models `list-objects-filter-options.c`, `parse.c`, `object.c`, and `url.c` from Git 2.55. It validates blob limits, tree depths, object types, sparse object references, and nested combined filters. Base-0 numbers and k/m/g suffixes use the selected executable's 32- or 64-bit C long maximum. ABI-dependent values use the existing build-options probe; values valid on every supported width need no probe. `sparse:oid=` accepts even an empty name at this stage; object resolution remains Git's responsibility. Combined filters discard empty components, reject unescaped reserved bytes, and percent-decode each component before parsing it. Malformed percent escapes and `%00` remain literal, as in Git.

Clone and fetch enable `auto`. Their shared option group contains before-token constraints and ordered state effects. Auto cannot coexist with any other positive filter, including another auto. Clearing permits a new choice, but an implicit conversion from a simple filter to a combined filter clears Git's `allow_auto_filter` flag permanently. An explicitly supplied `combine:` does not make that conversion. The schema preserves this observable difference, including after `--no-filter`.

Native tests cover all seven direct parse-options callback tables, the manual fetch-pack parser, and rev-list's revision parser. They enumerate every sequence of length one through four over `{blob:none, combine:blob:none+tree:1, auto, --no-filter}` for both clone and fetch, with longer reset witnesses. This is deterministic bounded sequence coverage, not an exhaustive proof for arbitrary argv or repository state. Type fixtures check grammar literals, conflicts, reset behavior, and the persistent native state change.

The grammar also propagates to scopes that inherit revision options. Those commands' preprocessing/help timing still needs separate auditing: for example, log handles `-h` before revision callbacks. Convenience-method filter validation is also shared through final scalar rules (below). TypeScript checks numeric bounds and percent-decoded components within its compiler budgets. Long numeric/whitespace inputs and decoding walks beyond those budgets defer to runtime instead of hitting compiler recursion limits. The native corpus reads the selected Git's long/size_t widths instead of assuming the host Node ABI. Controlled adapter tests cover both long widths; a native 32-bit-long executable was not tested locally. Numeric binary prefixes are accepted only when a read-only clone-help probe confirms support in the selected Git; unknown/localized probe results leave validation to native execution. No OS-name guess is used. Signed-char rejection of raw and nested decoded non-ASCII bytes is resolved against the selected executable through a readonly probe, with separate signed/unsigned-char corpora described in [Object-filter byte and literal constraints](#object-filter-byte-and-literal-constraints). Other ABI/libc combinations and command-specific behavior still require auditing. All affected command audits remain partial.

## Final scalar constraints

A `scalar` constraint associates a normalized option key with one of the shared value parsers. Runtime validation and the finite-domain decision diagram both evaluate that declaration. This supports values that Git checks after parsing: an invalid earlier value can be overwritten or cleared before a final rule runs. Immediate option callbacks retain their separate before-token validation.

Clone and fetch check their final depth with `atoi`, before transport-specific parsing. The pinned Linux libc profile converts the decimal prefix to a signed long (clamping overflow) and then to a signed 32-bit integer. Consequently, `2147483648` fails this check while `4294967297` and `-4294967295` pass. The shared final rule preserves those results in CLI and convenience APIs. `1suffix` also passes this initial stage; a transport may reject it later. Native tests use fetch with no remotes to isolate the initial stage, and actual local clones to verify wrapped numeric values. Transport-specific checks and other libc/data-model profiles remain open.

The clone and submodule-update convenience methods now use the shared object-filter grammar before spawning Git. Their non-generic option objects retain broad string fields, so those value grammars are checked at runtime. The generated compiler fixtures deliberately project out scalar and numeric checks that broad public property types cannot express. Generic literal command arguments retain their existing grammar checking, and exact finite-domain counts still include scalar rules. Representative scalar values are explicitly recorded, including valid forms and overflow boundaries; these are bounded domains, not complete string languages.

The depth literal proof rejects zero decimal prefixes and missing decimal digits before runtime, including known-invalid union arms. Opaque and dynamic inputs, overflow and other atoi profiles remain runtime checks. The scan and leading-whitespace proof are bounded to 192 characters rather than imposing a compiler depth constraint on valid Git input. Clone regression fixtures have three commits and use file:// for both native Git and TypeGit; a depth of 1 must retrieve one commit and produce a shallow repository. Wrapped depth cases use the selected Git build’s reported C long width to model transport.c’s strtol conversion followed by storage in int. LP64 retrieves one shallow commit; LLP64 saturation can retrieve all three commits without shallow state. Both native Git and TypeGit must match those history and shallow-state expectations. This transport conversion is separate from the initial atoi check.

## Compiler-recorded integer constraints

`spec/upstream/git-numeric-options.json` records all 67 `OPTION_INTEGER` and
`OPTION_UNSIGNED` definitions in the pinned preprocessed tables. The importer
compiles the 34 translation units without linking or running Git. It follows GCC
raw-tree initializer references to obtain evaluated storage widths, enum flags,
and optional defaults, and requires exact identity coverage against the existing
table snapshot. All 221 Git-local input dependencies are fingerprinted. The
compiler version, target, flags, and `CHAR_BIT` are recorded; reproduction needs
that profile. `commands:upstream-check ... --c-tables` reproduces both snapshots.

The recorded definitions contain 54 signed 32-bit, five unsigned 32-bit, and eight
unsigned 64-bit values. Generated option schemas carry the shared structured
parser `{ kind: 'integer', signed, bits }`, with source-declared `nativeWidth` on seven unsigned-long bindings and the backfill size_t binding. Runtime uses the selected Git build's reported widths when validity depends on them; the saved aarch64 snapshot remains the source profile, not a claim about every executable. When its handler is reached, Git 2.55 rejects overflow before a subsequent overwrite. Help in an earlier parser pass can skip that handler; a later `-h` in the same pass cannot undo a handler error. Negation assigns zero where
supported; optional values use the evaluated defaults (for example, merge log
length 20 and show-branch `--more` 1). This parser is distinct from clone/fetch's
initial `atoi` depth check and from bespoke callbacks.

Values may be safe integer numbers, bigint values, or native strings. Strings
preserve base-0 decimal/octal/hexadecimal notation, ASCII leading
whitespace, signs, and case-insensitive `k/m/g` units. Binary notation is accepted only when the selected Git/libc supports it; the same readonly clone-filter probe used for object filters observes that support. The finite exploration report explicitly uses the recorded 64-bit compiler/libc profile and separates long and size_t bindings. The bounded unsigned parser rejects
spelled negative zero. Strings and bigint retain full 64-bit precision; unsafe
JavaScript numbers are rejected as an explicit precision-preservation policy.
Argv retains the input spelling, while combination constraints see the normalized
integer. Literal TypeScript tuples use generated small multiplication tables to
normalize the same grammar before bounds and combination checks. Scalar validation for dynamic values
and very long literal strings is deferred to runtime.

`native-integer-exploration.json` lists deterministic boundary representatives,
their normalized results, and every generated scope using these parsers. This is
a finite verification report, not exhaustive discovery of Git semantics. The
native tests compare three storage profiles against independently invoked Git
and exercise validation before overwrites across the generated numeric options when parsing completes.
Command-specific semantic restrictions, callback-defined numeric languages,
configuration-derived defaults, platform differences, and preemptive help paths
remain separate audit work. All command audit entries remain partial.


Runtime also preserves the older decimal/int parser family observed in Git 2.25
and 2.47. A readonly `column --width=2147483648 -h` probe distinguishes that
family from the bounded parser when their accepted inputs differ. The older
family uses decimal `strtol`, ignores range errno, and assigns the result to an
int; saturation depends on the selected Git's C long width. Fixed unsigned
32-bit fields retain the resulting unsigned bit pattern. Source-declared long
and size_t bindings keep their distinct magnitude parser. No Git version or OS
name selects the family. Unknown or localized frontends retain native validation;
malformed arguments, universally invalid values, missing byte capabilities and
cancellation retain their early handling. Probes use the requested context and
per-call environment and never use caller stdin or contact a remote.

Public literal command tuples consider each observed parser family against the
whole input tuple. Guaranteed-invalid lexical or unsafe-number union arms remain
invalid; a union requiring incompatible parser families is rejected. Explicit
compiler-profile integer helper types remain precise. Older decimal literals
with overflow defer their normalized state to runtime rather than claiming that
every supported C long profile wraps identically. Repository-specific semantics,
other parser families, exact overflow literal normalization and larger value
languages remain separate audit obligations. Native regression tests compare
accepted/rejected spellings and an actual local pack's output bytes, not only
success against help. Saved source profiles and finite evidence do not establish
complete coverage of any audited command.


Unsigned magnitude sign acceptance is an independent native property. Git 2.25
accepts negative zero and unsigned `strtoumax` sign conversion, whereas the
observed 2.47/2.55 parsers reject a spelled minus. A readonly
`pack-objects --max-pack-size=-0 -h` probe selects this property only when it
changes validation. ERANGE is checked against uintmax before negation, then unit
multiplication overflow and the destination width are checked. Runtime, literal
math and final scalar rules share that order. The newer backfill size_t binding
has no observed older implementation (2.25/2.47 lack the command) and retains its
strict sign policy instead of inventing an old-command alternative.

Resolved scalar dimensions flow through transition and final-rule checks. Clone
and submodule convenience filter validation similarly observes the selected
sign/long profile when needed; an unknown frontend retains native validation.
The old-profile clone regression uses a nonempty file:// repository and compares
HEAD and the stored partial-clone filter against native Git. Each parser family
and sign profile must validate the complete literal tuple, preserving known-bad
union arms. Explicit fixed-profile helper types retain their own constraints.

## Numeric callback conversion stages

`spec/git-numeric-callbacks.json` separates callback semantics from the native
integer table handlers. Its source-audited profiles record strict decimal syntax,
`strtol` overflow saturation at the selected executable's C long width, checked or cast 32-bit storage, signedness,
empty values, and checks before/after conversion. Source fingerprints include the
implementations and storage/default declarations. This is an explicit source
audit, not automatic discovery of every C callback. The generated profile module
also supplies the `cherryPick` and `revert` convenience-method mainline rules.

For example, on C long 64, `--mainline=4294967297` and `--mainline=-4294967295`
both narrow to one, while `--mainline=2147483648` becomes negative and fails.
On C long 32, the last value saturates to positive `INT_MAX`, and the negative
value saturates to `INT_MIN` and fails. Native parse-options
integer handlers instead reject overflow and accept base-0/unit spellings.
In the pinned Git 2.55.0 source profile, revision counts use strict decimal
checked integers; tab widths and apply strip counts add a nonnegative check.
Diff context checks negativity before narrowing to unsigned storage, whereas
grep context can narrow a negative int into unsigned context.
The abbreviation callback clamps nonzero results below four after conversion.
The separate revision parser's permissive `--abbrev` handling remains distinct.

Numbers, bigint values, and strings use the same declared profiles. Literal
TypeScript normalization uses deterministic decimal subtraction/modulo tables;
invalid literal unions are rejected, while dynamic inputs and very long strings
receive runtime scalar validation. Numeric shorthand preserves digit strings
rather than rounding them through JavaScript numbers. Absent optional diff
context preserves prior state. Where an optional short option has an equivalent
long spelling, an explicitly empty value uses that long equals form: `['-U', '']`
becomes `--unified=`, preserving zero context instead of accidentally requesting
the omitted-value behavior. Other argument spellings stay unchanged.

The finite numeric exploration report includes these profiles and their boundary
representatives. Tests compare parser rejection with independent Git, verify
normalization-dependent combination errors, and execute wrapped mainline values
through convenience methods. Nongeneric convenience numeric fields still rely
on runtime scalar checks. These additions do not establish whole-command
semantic completeness; all audit scopes remain partial.

Callback implementations are selected independently using readonly parser probes,
in the same execution context and environment as the requested command. Git
2.25.1 and 2.47.3 accept negative unified context and store signed int; 2.55.0
checks negativity before storing unsigned context. Revision count is checked in
2.47.3 but apply strip count and daemon connection count still use atoi there.
The older atoi callbacks consume an initial decimal prefix and accept empty or
non-numeric strings as zero. Unknown probe output delegates validation to the
original native argv. Modern daemon timeout helpers reject every minus sign, including negative zero, before unsigned conversion. Finite JavaScript numbers within the safe magnitude range retain their emitted spellings; older atoi can consume a prefix from a fractional or scientific spelling. NUL cannot occur in an argv word. Build metadata determines C long width when validity
changes with that width; decimal callbacks retain native validation if those
metadata are unavailable. Types evaluate whole-tuple callback alternatives and
retain precise helpers for an explicitly declared source profile. Manual
fsmonitor options use native OPTION_INTEGER semantics, including radix and unit
suffixes, rather than revision count parsing. These observations do not prove
whole-command completeness.

## Object-filter byte and literal constraints

Combined literals follow native split, reserved-byte validation, nonzero percent decoding and recursive parsing. Malformed escapes and `%00` are preserved. Numeric bounds use the shared integer literal parser, with the selected negative-magnitude policy retained. Symbolic numeric slots and bounded compiler walks defer to runtime. The checked-in 1,331-case corpus records Git 2.55 LP64 with unsigned char; it is reproduced using a separately built unsigned-char executable and is not portable evidence for signed-char Git. Runtime validation resolves the selected executable's C char behavior for raw and nested decoded high bytes with a readonly clone callback, without a URL. The same context, environment and cancellation signal are used; original stdin is reserved for the requested command. Unknown probe results preserve native validation. An additional signed-char corpus records the same 1,331 cases and supplies explicit signed-char compiler assertions. `ObjectFilterLiteral` retains its negative-magnitude third argument and accepts an unsigned-char fourth argument; the default represents the permissive unsigned-char alternative for an unknown target. Finite invalid unions remain rejected. Run `node scripts/object-filter-corpus.mjs --signed-char --check` on signed-char LP64 Git 2.55, and the default `--check` on unsigned-char LP64 Git 2.55. All audit scopes remain partial.

## CLI string representation

NUL cannot be represented inside an OS argument string. This is a transport
restriction, independent of Git's command-specific parsing and help behavior.
`ARGV_STRING_CONSTRAINT` records this wrapper representation rule once in the
command schema, with its reason and provenance. Runtime and literal checks use
its forbidden character. The typed command API checks literal tuples before
dispatch and rejects known NUL bytes in option values or operand objects,
including literal unions and templates with a known NUL. Each tuple position is
checked independently so another dynamic string cannot hide a known NUL. The runtime builder checks the same representation boundary for dynamic inputs before GUI grammar lookup, child dispatch, and ABI or parser-profile probes. Metadata fields that are not emitted as argv words are ignored. Broad strings and arrays with unknown elements retain runtime validation. Known NUL values are rejected even in variadic tuples or arrays whose length is not known. Stdin is a data stream and continues to
accept NUL; it is not an argv string. Convenience option objects and
execution-environment fields require separate auditing; this rule does not claim
whole-command or whole-wrapper completeness.

## Ordered parser exits

`CommandSpec.parserExit` records an audited parser's exit flags with upstream
provenance. Its `exceptFirst` list excludes the initial `--help`: Git rewrites
that position to a separate `git help` invocation before the command parser.
That dispatcher grammar remains a separate audit obligation. In a single parse-options pass, encountering one of these flags
terminates interpretation. Earlier callback failures remain errors, while later
callback values, mode transitions and final semantic constraints are not reached.
The builder still serializes all supplied words; the compiler stops its state
walk at the same point. A value spelling `-h` is not an exit token, and a help
spelling after `--` or after a stop-at-operand boundary is not an active option.

The 20 audited scopes are `add`, `rm`, `mv`, `commit`, `fetch`, `push`, `clone`,
`merge`, `reset`, `clean`, `rebase`, `checkout`, `switch`, `restore`, `status`,
`branch`, `for-each-ref`, `tag`, `show-branch` and `shortlog`.
The five latter scopes also share audited `--color` callbacks that accept only
ASCII case-insensitive `always`, `auto` and `never`, default to `always` without a value, and assign `never` when negated.
Config boolean synonyms such as `true` are not accepted. Consequently
`--color=invalid -h` is rejected and `-h --color=invalid` reaches help. Enum-valued
options in these scopes expose their primitive string shape; literal membership
is checked in the ordered state walk, and dynamic strings are checked at runtime.
OS NUL checks and the structured API's option names/value shapes remain active
even for words ignored by Git.

`node scripts/parser-exit-corpus.mjs --check` replays a deterministic independent
Git 2.55.0 corpus, classifies native diagnostics, and reproduces the runtime and
compiler fixtures. This finite corpus is not an exhaustive command proof.
The annotation is deliberately per scope: `grep -h` is an ordinary option and
`diff-files` processes those options before handling help. Other exit phases, completion helpers,
abbreviations, repository/configuration failures and other parse exits remain
separate audit obligations. All command audit entries remain partial.


### Conflict-style parser timing

Git 2.25.1 stores `--conflict` in `checkout`, `switch` and `restore` as an
`OPT_STRING` and validates its last value after parsing. Git 2.47.3 and 2.55.0
validate each occurrence immediately. Thus `--conflict=bad -h` reaches help on
2.25.1 and fails before help on the newer profiles. Runtime observes the selected
executable through a readonly help probe in the original context and environment.
Unknown probe outcomes leave validation to the original native command. Probes
preserve command stdin and cancellation prevents the requested execution.

Literal types apply each parser family to the whole tuple. The optional
`CommandGrammarContext.conflictStyle` selects `immediate` or `deferred` timing;
the independent Git 2.55 compiler corpus selects `immediate`. Unknown timing
accepts tuples valid under a supported family, while known NUL words and final
invalid conflict styles remain rejected. This timing choice does not establish
that every deferred version supports every style: `zdiff3` support and repository
conditions remain native obligations. A first `--help` selects `git-help` and does
not make its unknown conflict option valid; a preceding internal `-h` still stops
option interpretation.

## Boolean callback profiles

`spec/git-boolean-callbacks.json` records Git's textual boolean names, signed
32-bit integer parser and seven callback profiles. Generated constants are shared
by runtime validation and compiler literal checks. Callback profiles distinguish
fetch recursion (`on-demand`), push recursion (`on-demand`, `check`, `only`, but
no true value), signed push (ASCII case-insensitive `if-asked`), pull rebase
(`merges`/`m` and `interactive`/`i`) and ordinary boolean worktree recursion.
The push-only `only-is-on-demand` transition rewrites a previous `only` value;
otherwise it preserves the previous value.

Numeric literals use the same radix/unit/bounds model as Git configuration
integers. Known values are normalized before combination checks: `0k` disables
recursion, while `1k` enables it and conflicts with fetch porcelain mode. Broad
strings, symbolic string templates and compiler walks beyond 128 characters
retain an unknown string state and are checked at runtime. Known invalid members
of literal unions are rejected. Optional values explicitly passed as `undefined`
continue to use their schema defaults.

Additional native transcripts cover Git 2.25.1 and 2.47.3. Their config
integer parsers reject INT_MIN; 2.25.1 also treats a bare `k`, `m` or `g` as
zero. This makes pull `--rebase=m` normalize to false on the recorded old
parser, rather than the newer named `merges` mode. Compiler alternatives replay
a complete argument tuple for each recorded source family, preserving callback
order and rejecting invalid literal-union members.

At runtime, readonly `git -c … config --type=bool --get …` observations select
the config grammar and libc binary-prefix support independently. Availability
of pull `preserve`/`p` and push `only-is-on-demand` is observed separately through
the original callback followed by `-h`: intermediate upstream sources show that
these features cannot be inferred from the config integer grammar. Observations
use the selected command context, environment and cancellation signal without
consuming command stdin. Unrecognized responses retain native execution and its
diagnostics; aborted observations stop execution. Audited help exits, including
pull, prevent observations and semantic checks for later words while retaining
argument representation checks. The three compiler source alternatives are
recorded families, not a claim to model every intermediate or customized Git.

The independent oracle `node scripts/boolean-callback-corpus.mjs --check`
reproduces 59 native boolean values (including their normalized output) and 649
callback outcomes at 11 option sites in eight commands. It requires the pinned
Git 2.55.0 signed-integer/libc profile. Native ASCII matching also rejects
`if-asKed`, which JavaScript Unicode lowercasing would incorrectly accept.
The command explorer derives the complete finite set of normalized boolean and
callback-name values directly from these profiles; it does not approximate them
with arbitrary string samples. This is a per-field domain, not a proof that every
combined command state is reachable. Source fingerprints are checked by the upstream verifier. The finite corpus
and bounded literal evaluator do not claim completeness for every platform or
command; help phases, repository state and dynamic values remain audit work.

## Compound decimal callbacks

`spec/git-compound-decimals.json` describes a comma-separated numeric tuple
with defaults and an optional numeric prefix followed by an opaque tail. The
shortlog tuple uses defaults 76/6/9 and requires a nonzero width to exceed both
indentations. The reflog callback parses only the prefix before the first comma;
its later date/object resolution is outside this lexical model.

Both profiles use the selected executable’s C unsigned long width through the
shared decimal parser. The pinned corpus explicitly records LP64; builder/scalar
comparisons against that corpus supply its 64-bit width even on another host.
Negation occurs in unsigned long. The ordinary profile saturates magnitude
overflow at `ULONG_MAX`; an independently observed profile negates negative
overflow to 1. Windows CI demonstrated that the latter difference affects actual
Git acceptance, so host platform names and long widths alone do not select it. Shortlog then checks `INT_MAX`; show-branch stores an int before its
later fallback logic. Thus `-18446744073709551540` becomes width 76, but
`-18446744073709551616` saturates and fails shortlog's range check. A trailing
newline is an unconsumed character in a numeric field; a newline after reflog's
comma belongs to its opaque tail and is accepted by this callback.

Compiler checks consume the same profiles and numeric conversion rules, including
field defaults and width/indent comparisons. Width-sensitive tuples replay one
consistent 32- or 64-bit long profile across every field and repeated option.
For example, `-4294967220` becomes width 76 only for 32-bit unsigned long; a
command combining it with a 64-bit-only width spelling has no valid whole-tuple
profile. A mixed field list can, however, be valid when overflowing negative
indentation converts to 1; compiler alternatives retain that observed case.
A readonly `shortlog -w2,-18446744073709551616,0 -h` observation distinguishes
negative overflow acceptance independently of long width. Readonly trait and
width observations retain the original context, environment and signal
without consuming command stdin. Unrecognized metadata delegates to the original
native command; aborted observations stop execution. Values after audited help
do not trigger observations, and argument representation guards remain earlier. Symbolic values and bounded numeric
walks retain runtime checks without hiding another field's known violation.
Shortlog's parse-options/revision-option loop processes unknown options inline,
so its help exit is ordered, unlike log's separate early parsing pass. Shortlog
also uses the shared color callback grammar.

`node scripts/compound-decimal-corpus.mjs --check` reproduces 873 independent
numeric outcomes and seven ordered help/color cases across finite tuple
combinations, numeric boundaries, whitespace and comma tails. This does not prove every platform, repository condition
or unbounded input language complete. All command audit entries remain partial.

## Initial parser exits before deferred options

Six additional scopes (`log`, `show`, `whatchanged`, `fast-export`, `cherry-pick`
and `revert`) use an initial `parse_options` pass with `KEEP_UNKNOWN_OPT` before
revision/diff parsing. `parserExit.firstPassTables` in the source scopes names
that pass's pinned upstream tables. Generation resolves aliases and negations
into `firstPassOptions`, with original long names for Git's single-dash typo
check. These declarations appear in the deterministic exploration report.

Runtime and compiler interpreters walk serialized argv words. Recognized options
consume their values, including words originating in another API tuple. Unknown
words are deferred; long abbreviations are disabled by `KEEP_UNKNOWN_OPT`.
Short clusters follow the native lookup and typo-check order. `--` and
`--end-of-options` stop this pass. If help exits the pass, only the callbacks and
mode transitions reached before that exit are validated; later phases and final
combination rules do not execute. Output argv retains its original order.

For example, `log --color=invalid -h` reaches help, but
`log --decorate=invalid -h` fails its initial callback. `log -n -h` also reaches
help: the initial pass does not know `-n`, so the next word is an independent
help flag. Conversely, `log -n --decorate=invalid -h` reaches the invalid
decoration callback. A recognized `-L` consumes the next word, even `-h`.

For both the decimal `--unified` callback and native integer
`--inter-hunk-context` handler, help in the initial pass skips both occurrences.
For example, `log --unified=invalid --unified=1 -h` exits before conversion; the
same sequence with `--inter-hunk-context` behaves identically. Removing `-h`
reaches and rejects the first invalid value before its overwrite. Dedicated tests execute both sequences
against Git and retain all-scope conversion checks without a help exit.

The decoration and fast-export reencoding callbacks use the shared boolean
registry. Decoration additionally accepts case-sensitive `short`, `full` and
`auto`; reencoding accepts ASCII case-insensitive `abort`. Decoration's `auto`
value remains symbolic because its resolved style depends on the environment.
The six scopes also use the shared color grammar for callbacks reached in the
later diff pass. Boolean numeric parsing retains the independently observed
source family: Git 2.25.1 accepts bare unit values in decoration/reencoding,
while the recorded newer parsers reject them; INT_MIN differs separately.

Cherry-pick's initial `--empty` behavior is observed separately using readonly
`cherry-pick --empty=type-git-invalid -h`. An older initial option set preserves
that word until help, while the newer callback validates its value before help.
This does not infer option availability from the boolean integer grammar or a
version string. Unrecognized/localized responses retain native execution;
aborted observations stop, preserving context, environment, signal, and binary
result shape without consuming command stdin. Trait discovery uses reached
initial-pass tokens, so a split value that becomes help suppresses later probes.
Compiler alternatives replay a whole initial option set and scalar profile.
An explicit `firstPassEmpty: true` context pins the modern initial option set;
the independent 2.55.0 corpus explicitly pins that and the modern boolean family.
Original argument tokens remain available to every existing constraint check.

`node scripts/phased-parser-exit-corpus.mjs --check` reproduces 669 independent
native outcomes and their compiler fixtures. It enumerates permutations of
initial/deferred callbacks, help and operands, then exercises value bounds,
split values, short clusters and separators. Separate interpreter assertions
cover consumed help and both stop markers without claiming to validate the
remaining revision stream. Literal parser walks stop after 128 steps; dynamic
words and budget-exceeding cases defer to runtime. Known invalid union branches
are retained as errors. Structured value-shape and OS NUL checks always apply.

When the initial pass does not exit, its retained argv is decoded by the
revision/diff phase described below. Completion helpers, other callbacks, global
help dispatch and repository-dependent revision/path classification remain unfinished. All 430 audit scopes remain partial.

### Independently observed depth conversion and submodule helper aliases

The final clone/fetch depth check still uses `atoi` in the audited Git sources.
The recorded conversion profiles saturate at 32 or 64 bits before signed-int
storage. This dimension is independent of the selected executable's C long
width and its other numeric callbacks. The CLI and convenience methods share
an observation that invokes `clone --depth=2147483648` with a synthetic remote
and an existing temporary file as destination. Depth rejection or the existing
file check stops execution before transport and destination creation. The file
is removed even when observation aborts. Original context, environment and
signal are retained; command stdin is not consumed. Unrecognized diagnostics
retain native handling rather than inventing an observed profile.

`DepthInitialLiteral<V, Bits>` models these conversion stages using the shared
decimal type interpreter. Its default accepts an input only when one complete
recorded profile accepts every known union member. For example, `-1` and a
negative overflow below INT64_MIN are invalid in both profiles, while
`2147483648` and `-4294967295` distinguish the profiles. Symbolic numeric prefixes
and compiler-budget cases still defer to runtime, and a known invalid union
member or literal NUL cannot be erased by deferral. A pinned 64-bit contract
records 25 independent Git 2.55.0 final-depth outcomes. Other CRT behavior and
transport-specific conversion remain separate audit obligations.

The [Git 2.56.0 helper option table](https://github.com/git/git/blob/v2.56.0/builtin/submodule--helper.c)
registers short `-i` for update initialization; the pinned 2.55.0 table does not.
The shell frontend forwards its final init spelling, so the helper capability
changes whether `submodule update -i` is valid. Readonly
`submodule--helper update -i -h` observation selects that capability without
performing an update. An older Git that has no update helper, or an unknown
response, retains the original native execution. The serialized words are
preserved. Explicit `submoduleInitAlias` type contexts pin either capability;
unpinned contexts retain the applicable complete-command alternatives. Type
normalization to `--init` is used only for semantic checking of the accepting
profile and does not rewrite executed argv. Reset/filter prerequisites,
repository guards and other scalar checks remain in that command check.

The filesystem adapter may allocate a temporary path without creating its file.
The depth observation explicitly writes the blocking file before invoking Git;
an adapter without file-writing support skips that observation and keeps native
handling. A regression checks real file existence at the spawn boundary and
cleanup afterward. Merely allocating a pathname does not establish a safe
transport-stopping probe.


## String callback languages

`spec/git-string-callbacks.json` declares two case-sensitive regular string
languages and their pinned source hashes. A choice profile contains exact words
and prefixes with arbitrary suffixes. A first-separator profile requires two
nonempty fields, with an optional nonempty identity form when no separator is
present. Runtime and compiler interpreters consume the generated declarations;
neither keeps a second hand-written list of accepted modes.

`fast-export --anonymize-map` splits on the first colon. `name`, `one:two` and
`one:two:` are accepted; an empty string, `:name` and `name:` are rejected.
`fast-import --signed-tags` and `--signed-commits` use the modes in Git's
`parse_sign_mode`, including the exact aliases and `sign-if-invalid=` followed
by any key text. The empty key suffix is accepted. Key lookup, signing and
verification outcomes are outside this lexical grammar.

The compiler walks to the first separator and defers when a symbolic prefix
could itself contain one. For example, `${string}:` may represent `one:two:`
and therefore cannot be rejected just because its visible suffix is a colon.
A known empty key and known invalid union members are rejected. Dynamic strings
and walks beyond 128 characters defer to runtime; NUL remains an independent
OS representation error. Command parser timing still applies, so an invalid
anonymization map after a reached initial-pass help exit is ignored.

`node scripts/string-callback-corpus.mjs --check` reproduces 962 native callback
outcomes, with 960 within the compiler budget. It exhausts strings of length
zero through four over a five-character alphabet (including colon, newline and
Unicode), then probes exact signature modes, aliases, prefixes and mutations.
The fast-import oracle supplies empty stdin in an isolated repository; it does
not sign or import commits. The finite corpus does not establish command-wide
completeness. All audit entries remain partial.

## Retained argv and revision/diff phases

For the six initial-pass scopes, the parser result includes the exact retained
argv. A consumed short-option prefix is removed from a cluster; operands and
unknown words keep their order. `keepDashDash` records whether the initial pass
retains `--`; `--end-of-options` is always retained. Git's global leading
`--help` dispatch is kept separate from this command pipeline.

The subsequent phase has its own option definitions from pinned diff tables and
revision declarations. A flag such as `-n` therefore retains its phase-specific
meaning. The revision snapshot additionally records which `parse_long_opt`
branches accept detached values; `--default` has its separately recorded
manual detached-only form. Manual revision spellings are matched before diff
short clusters, without enabling long abbreviations. Reached callback effects
are applied in phase order before final combination rules.

When `setup_revisions` searches for `--`, it does so before consuming option
values. Its tail becomes path operands. The sequencer's `assume_dashdash` mode
omits that search, and its leading retained `-` is translated to `@{-1}`.
`--end-of-options` stops option lookup when reached, but can itself be consumed
as an earlier option's value. All these operations use serialized words, so
boundaries can fall inside API tuples. The original argv is still emitted.

For example, `log -G -L -h` fails because the initial `-L` consumes `-h` and
leaves `-G` without a value. `log -n -L 1,1:file 0` leaves `-n 0` for the next
phase and is valid with the referenced file. `log -- --color=invalid` treats
the last word as a path; `fast-export -- --color=invalid` removes its first
separator and reaches the invalid color callback. An option tuple still
controls serialization and value shape, but the native phases determine how
its emitted words are interpreted.

`node scripts/residual-argv-corpus.mjs --check` reproduces 134 independent Git
outcomes in a seeded, isolated repository, including previous-checkout handling.
Both runtime and bounded compiler interpreters are checked. Existing history,
revision/diff and sequencer tests cover the surrounding rules. This does not
complete repository-dependent revision/path disambiguation, stdin languages,
all callbacks or every early exit. All audit scopes remain partial.

Identical later-phase dictionaries are shared in generated source and declaration
types. `pnpm test:types` checks all source and contract roots together using the
unchanged `tsconfig.contracts.json` project.

The native corpus pins the observed Git 2.55 boolean and decimal callback
families. Public calls without an explicit profile retain supported older Git
behavior: Git 2.25 accepts residual `-n bad` through its older integer callback,
whereas Git 2.55 rejects it. Trait discovery uses the words consumed by both
parser phases, including options embedded in an earlier API tuple's value.

## Ordered reflog wrappers

`parserExit.wrappers` records native parser passes before the log option pass.
Each entry currently describes an empty option table, including optional
subcommand dispatch, with its source evidence and separator policy. Generation
checks the pinned table and rejects wrappers containing option callbacks; these
need their own stateful phase model. `stopAtUnknown` records the optional
subcommand parser's return at the first unknown option or operand. Both literal
and runtime interpreters pass the retained words through wrappers in order.

For `reflog show`, the empty wrapper scans unknown words for help before log
callbacks execute. Consequently `reflog show --decorate=bad -h` displays help,
as does `reflog show -G -L -h`. In the root `reflog` fallback, the subcommand
wrapper stops at the first unknown word. The log pass then rejects the first
example's decoration, or consumes the second example's `-h` as the `-L` value
and leaves `-G` without a value. A first `--help` after `show` is local help;
the root command's global `--help` dispatch remains separately deferred.

Both reflog scopes now share log's decoration grammar, color grammar and
subsequent revision/diff parser. Existing implicit reflog traversal and final
combination rules still apply when no parser exits. The API emits the original
argv and checks representation constraints even after help.

`node scripts/wrapper-parser-corpus.mjs --check` reproduces 425 independent Git
outcomes, including direct `reflog show` and dispatch through a `show` operand.
The corpus checks callback order, retained words, separators, numeric values,
short clusters and final traversal rules in an isolated seeded repository.
Runtime tests, compiler fixtures and the installed npm package cover these paths.
This finite corpus does not establish complete coverage: configuration, object
resolution, remaining callback grammars and completion exits stay open. Stash
list's repository-dependent delegation requires a separate conditional phase.
All 430 audit scopes remain partial.

## Format-patch parser phases

`format-patch` records its own first option table followed directly by
`setup_revisions`; it does not run the log option table between these phases.
The first pass preserves `--` and unknown words, consumes values and short
clusters, and invokes its reached callbacks before local help. Subject/cover
combination checks and revision/diff callbacks are skipped when help exits.

For example, `format-patch -n -k -h` displays help before checking the conflicting
subject modes. `format-patch --thread=bad -h` fails in the thread callback first.
Repeated output directories also fail before help. A deferred invalid color is
ignored when the first pass reaches help. The first-pass `-n` means numbered
patches, while retained revision words use the revision dictionary. Consequently
`-G -n x` leaves `-G x` after applying the numbering flag.

`node scripts/format-patch-parser-corpus.mjs --check` reproduces 187 native
outcomes, including permutations of early callbacks, final checks, revision
callbacks, help and operands. Probes run in an isolated seeded repository with
stdout selected and an empty revision range. Git's invalid thread callback can
return status 129 with no diagnostic; the oracle distinguishes this from help
by the actual usage output. Runtime and compiler tests consume the same native
outcomes, and npm integration checks published declaration behavior.

Repository/configuration state, identity parsing, object-name callbacks, files,
resolved-series constraints and completion/global-help behavior remain partial.
The existing subject/cover constraints are checked after replaying both phases;
their keys cannot be overwritten by the later revision option dictionary. This
preserves rejection but does not promise Git's ordering between two diagnostics.
All audit scopes remain partial.

The corpus fixes the observed integer profile as well as the decimal callback
families. Git 2.25 accepts `--start-number=2147483648` through narrowing, while
Git 2.55 and 2.56 reject it before help. Unpinned public literal checks retain
that older supported behavior. `CheckedCommandArguments` contexts can pin
`integerProfile` independently to `bounded` or `decimal-cast`; a decimal callback
pin does not silently fix the integer profile.

The growing native-oracle contract suite is checked as one complete TypeScript
project. `pnpm test:types` sets a 12 GiB Node old-space limit so every source and
contract root can remain in the same program. This changes the compiler's
memory allowance; it does not skip diagnostics, remove fixtures or split the
full contract check into independent compiler runs.

## Repository-conditioned child commands

`conditionalCommand` records a native reference-existence gate after an empty
first parser. It names the reference, the successful no-child branch, and the
child command with fixed argv before and after the retained user words. The
child branch also records whether its exit status is preserved or converted to
zero/nonzero. `conditionalCommandPaths` enumerates absent and present states in
a fixed order, or selects a known state, without consulting a repository.
Generation checks that this model is attached to an empty first parser and does
not silently skip option callbacks or unconditional semantic rules.

`stash list` now inherits the typed log option vocabulary. Its empty native
parser still detects help and single-dash typos before looking up `refs/stash`.
It drops the first `--` and retains the later words. If the ref is absent, Git
returns success. Otherwise it invokes:

```
git log '--format=%gd: %gs' -g --first-parent <retained words> refs/stash --
```

The parent stash dispatcher converts a nonzero child status to 1. An earlier
help exit from the empty parser still exits directly with 129.

An unbound repository state permits either feasible branch. Thus both the
compiler and argument builder accept `stash list --color=bad`: Git ignores the
value without a stash and rejects it when a stash exists. The same applies to
child combination rules such as `--graph` with reflog traversal. The builder
performs no additional ref query; native Git evaluates its own gate at execution.
Primitive tuple shapes, NUL rejection and the unconditional parser still apply.
This is state-dependent deferral, not a claim that the child arguments are valid.

`node scripts/conditional-stash-corpus.mjs --check` reproduces 204 direct/dispatched API cases
(101 distinct argv forms) in both ref states, totaling 408 native outcomes. It independently
captures actual child argv with Git trace2 and probes child exit status. Runtime
and compiler fixtures check the unknown-state result; branch-plan tests compare
both known-state paths with the native traces. Public API tests create a stash
between calls and observe Git selecting different outcomes for the same options.
Successful command output and trace timing/identifiers are excluded from the
reproducible fixture.

The condition and injected argv are present in command and numeric exploration
artifacts. Child grammar/semantic validation remains delegated when repository
state is unknown. Configuration, object/path resolution, completion exits and
other conditional command pipelines remain audit obligations; all scopes remain
partial.

The conditional child plan and traced corpus pin Git 2.55's Boolean parent-status
mapping. Newer Git can retain a positive child exit status; Git 2.56 also returns
zero for successful local help. Public execution delegates to the selected Git,
and live tests compare its exact status and diagnostics with an independent
native invocation instead of assuming the pinned corpus's status mapping.

## Native option spelling and terminal operand phases

Stash apply, pop, drop, clear, branch, store, push and save now execute their
source-recorded option passes over serialized argv before applying final rules.
`unknownOptions`, `stopAtOperand`, `keepDashDash`, `keepEndOfOptions` and
`remainingOperands` record the parser flags and the consumer of the remaining
words. The same runtime and bounded literal interpreters handle these fields.

`parse-option-long-forms.mjs` deterministically compiles finite long-name
resolution tables from pinned native declarations. It records separate mappings
for bare and equals-attached words, including exact matches, unique prefixes,
negation and ambiguity. Exact matches take precedence over earlier ambiguous
prefixes. Git's very short negations can depend on the presence of `=`; for
example, stash drop accepts `--n` but rejects `--n=1`. Double `no-` handling
follows the native declaration's own `no-` prefix. Alias-family tables are
rejected by this compiler until their equivalence rules are supported; the eight
audited stash tables contain none. Short clusters and single-dash typo checks
retain their native order. Raw spelling examples use operand objects so the
serialized word, rather than an undeclared tuple name, reaches the parser.

Clear stops on its first operand, so `stash clear file -h` is an arity error.
Store uses KEEP_UNKNOWN_OPT, which disables long abbreviations and retains
unknown words for its object operand; `stash store --unknown -h` still displays
help. Store retains `--end-of-options`, while the ordinary parsers consume it.
Push drops a leading retained `--` before pathspec processing. Save keeps `--`
as part of its message. Retained words are replayed as literal operands and
never reparsed as options. The original argv is emitted unchanged.

Help exits before final arity and patch/context restrictions. An integer
callback still fails before a later help token: `stash push --unified=bad -h`
fails, whereas `stash push --unified=-2 -h` displays help. Without help the
existing final range and patch requirements apply.

`node scripts/stash-parser-corpus.mjs --check` reproduces 4,978 native outcomes across the eight explicit subcommands and assumed push.
It enumerates native-name prefixes with and without `=`, including negations,
short clusters and selected final constraints. The isolated repository is clean;
string-taking prefix probes end with two help words, and stdin is empty. A valid
stash object at `refs/tags/-h` makes the post-separator store case independent of
object absence. Runtime and compiler fixtures consume the independent results.
Configuration, path/object resolution, completion, alias families, other native
parser modes and further callback grammars remain open. All scopes stay partial.

The stash compiler corpus pins the bounded integer profile observed in Git 2.55.
Git 2.25 displays help for the tested overflowing context-option sequences,
whereas Git 2.55 and 2.56 report the reached integer range error before help.
The public unpinned type retains that source-dependent acceptance; the pinned
corpus does not narrow all supported Git versions to the recorded one.

### Stash parent help across source profiles

Git 2.25.1 parses an empty parent option table with KEEP_UNKNOWN and
KEEP_DASHDASH before dispatching a stash child. Git 2.55 stops the parent pass
at the selected subcommand instead. Thus `stash clear file -h` and
`stash push --unified=bad -h` display parent help in the older Git but reach
child errors in the newer Git. This is separate from integer lexical profiles.

The unpinned compiler accepts a literal tuple when the older parent pass
unconditionally reaches help. A Git 2.55 corpus pins `stashParent: 'modern'`
independently of its integer profile. Runtime execution sends source-dependent
parent-help cases unchanged to the selected Git, retaining its exact status and
diagnostics without performing child capability probes first. Representation
and NUL checks still run first. A retained `--` or an unknown `-xh` cluster does
not invent a parent help exit. Other source-dependent stash behavior remains
partial, including old option availability and non-help dispatch semantics.


## Assumed stash push and subcommand-name typos

On the pinned Git 2.55.0 profile, root `stash` records its optional-subcommand wrapper followed by the push table
with STOP_AT_NON_OPTION. Exact first-word dispatch still selects explicit child
schemas. Otherwise the first operand stops option parsing, so `stash file -h`
does not display help. A leading retained `--` is removed before pathspec
processing but preserved as a boundary in the validation state. Without that
boundary, only active patch mode permits implicit paths. A later `--` is just a
path: `stash file -- -h` still fails the assumed-push check. With patch mode,
`stash --patch file --unified=bad` treats the final word as a path, whereas
explicit push parses it as an invalid integer. Path existence remains native
repository-dependent validation. Tuples and operand objects serialize identically
before this parser pass; argv is emitted unchanged.

Native `check_typos` examines all long names, including subcommand declarations.
The generator therefore carries each wrapper table's names into both parser
interpreters. `reflog -sho -h` and `stash -push -h` fail at the wrapper before
fallback help; `reflog show -sho -h` reaches help in the empty show wrapper.
The independent native corpora enumerate these names' single-dash prefixes and
contrast assumed/explicit push boundaries in a clean repository with tracked
option-shaped filenames. These tests cover finite examples, not all argv or
repository states. Global help, completion, configuration, pathspec languages and
other callback grammars remain separate audit obligations; no scope is complete.

## Stash import/export parsing

The import and export scopes use their own native option tables with
KEEP_DASHDASH, ordinary long abbreviation, and unknown-option rejection. Both
consume `--end-of-options`, but retain `--` as a literal revision operand. Thus
`stash import -- -h` has two operands and fails its arity check. `stash import --`
has one operand; whether the literal `--` names a valid export chain is a native
repository question. Export similarly accepts a literal `--` stash reference.
These commands do not share push's leading-separator removal.

Help exits before final arity/destination rules. For example,
`stash export --print --to-ref=refs/exported -h` shows help; without `-h` the two
destinations conflict. `--pri` abbreviates `--print`, while `--no-print` is
rejected before help because the command-mode declaration forbids negation.
Native spelling tables and both existing parser interpreters provide this
behavior without command-specific runtime branches.

`node scripts/stash-transfer-corpus.mjs --check` reproduces 488 independent Git
outcomes, including root dispatch and direct scoped calls. An isolated repository
provides real stash commits for export and real export chains for import, with
literal `--` and `-h` refs. Both runtime and compiler fixtures consume the native
results. Ref syntax/resolution, export-chain topology, repository/configuration
state, completion and other parser modes remain audit obligations. These scopes
remain partial.

The transfer compiler corpus pins modern parent stash dispatch. Older Git can
display parent help before recognizing an unsupported transfer child or its
command-mode flags. The public unpinned type retains that help alternative;
actual execution preserves the selected native status and diagnostics. This
does not claim import/export support on Git 2.25.

## Stash show retained-argument partition

`parserExit.remainingPartition` records an ordered prefix partition before the
revision parser. Words beginning with `optionPrefix` remain in the option stream;
all other words populate the separate `operandKey` array. The runtime and bounded
literal interpreters use the same declaration. The generator checks the state
key for collisions, and deterministic state exploration includes its operand
cardinality domain. These normalized states are not a proof of argv reachability.

For `stash show`, the initial KEEP_UNKNOWN_OPT pass handles its own untracked
flags and help. It then partitions every retained word by a leading `-`, even
words after `--`. Plain words are stash references; dash-prefixed words enter
setup_revisions, which performs its own end-marker processing. For example,
`stash show -- --default foo` uses `foo` as the stash reference and `--default`
as a path. `stash show -- -h -unknown` has no explicit stash reference and two
paths. In contrast, `stash show -- foo one` supplies two stash references and
fails arity validation. Path arguments never increase the stash-reference count.

The modern initial pass rejects `--include-untracked=1 -h` before help;
Git 2.25 parent help can exit before that child-table check. Unknown diff
words are deferred: `--color=bad -h` displays help without running the color
callback. Long abbreviations are disabled in that initial KEEP_UNKNOWN_OPT pass.
Detached values are partitioned too: without help, `--default foo` leaves the
revision parser with a missing value. Existing native revision/diff dictionaries
and the shared color grammar apply only to the resulting revision stream.
Dynamic words, symbolic numeric templates and compiler-budget-exceeding literals
are deferred; known literal NUL remains rejected before parsing.

`node scripts/stash-show-corpus.mjs --check` reproduces all 1,150 independent
Git 2.56.0 outcomes against the pinned Git 2.55 option vocabulary in a repository with a real stash and valid plain/dash-prefixed refs.
Both scoped and root-dispatched calls are checked. A valid `-h` ref matters after
`--end-of-options`: a missing ref failure does not make that spelling universally
invalid. Runtime and compiler fixtures consume the same native outcomes. The
compiler corpus is divided deterministically into files of at most 400 cases,
all included together with every source and other fixture in the existing
12 GiB contract project. No isolated compiler batches are used.

Repository/configuration state, stash/revision object resolution, pathspec
languages, remaining revision callbacks, completion and other native parser
modes remain open. Every audit scope remains partial.

The stable execution corpus uses unmodified Git 2.56.0 because the local
unmodified Git 2.55.0 aborts on `stash show -G -L`. The full 2.55 observation
mode (`--observe --output=...`) retains every candidate, ordinary status and
signal; it does not infer argument validity from abnormal termination. The
2.56 release notes describe deferred revision-argument freeing to prevent
use-after-free, consistent with the cross-version native controls. All 1,150
cases remain in the stable corpus and compile together; no case is removed
to hide a native failure, and valid arguments on other Git profiles are not
rejected merely because one Git implementation crashes.

Required attached short options keep an explicit empty value as a separate
argv word, including before an early help exit. The type-level serializer
preserves the same boundary. Two empty values can therefore contribute two
stash references before a deferred callback; removing those words would
change the native argument partition. Eighteen additional scoped/root controls
cover these empty-value and help boundaries. An explicit empty stash reference
is rejected after initial help timing, consistently with all four native versions.

The full contract project exhausted the earlier 6 GiB heap after this corpus
was added. A 10 GiB diagnostic run completed and exposed two real empty-reference
regressions; those assertions remain and the corresponding rule is fixed.
At that stage the standard command used 10 GiB without splitting the project or removing
assertions. This increases the memory requirement; fresh CI must validate the
complete project on the configured runner.

## Ordinary worktree option passes

`add`, `rm`, `mv` and `clean` record their native option tables and ordinary
parse-options behavior: long abbreviations enabled, unknown options rejected,
and both `--` and `--end-of-options` consumed. Their remaining words become
literal path operands. Add's KEEP_ARGV0 retains the command name only for its
internal consumers; Type-Git already separates that name from the argument
stream. Native interactive/edit branches and their repository effects remain
separate from this option-pass model.

Serialized short clusters and native long prefixes are resolved before callback
checks. `add --dry-r -h` and `rm -nh` reach help, whereas `rm --quiet=1 -h` fails
first. Plain paths do not stop these parsers: `add file -h` displays help.
After a consumed marker, option-shaped words are literal paths. Thus `mv -- -h`
has only one path and fails arity; `mv -- file -h` has two paths, with their
filesystem validity left to Git. Add's `--chmod=bad -h` reaches help before its
final mode check, while a reached invalid integer callback still fails first.

`node scripts/worktree-parser-corpus.mjs --check` reproduces 3,935 independent
Git 2.55.0 outcomes across the four commands. Native names supply prefix/negation
candidates; Git supplies every expected result. Spelling probes have two final
help words, and final path/rule probes use dry-run in an isolated repository
with tracked dash-prefixed files. File-backed LF/NUL stdin supplies the selected
pathspec input mode without a broken-pipe race on early help exits. Runtime and
four compiler fixture files check all outcomes together with every other source
and contract root in the standard whole-contract project; none are omitted or isolated
in separate compiler runs. Source-specific fixtures pin the recorded modern
callback profiles; public checks retain independently selectable alternatives.

Configuration, interactive/edit execution, index/worktree state, pathspec and
filesystem resolution, completion and other parser modes remain audit
obligations. A finite corpus does not establish complete Git coverage.


## Reference, status and commit option passes

`branch`, `tag`, `status` and `commit` use their native ordinary option tables:
long abbreviations enabled, unknown options rejected, both end markers consumed,
and remaining words retained as operands. LASTARG_DEFAULT is distinct from an
ordinary optional argument. For example, `branch --contains` defaults to HEAD,
but `branch --contains -h --color=bad` consumes `-h` as the object argument and
then rejects the color. `branch --track -h` instead reaches help. Nonempty object
names are resolved by Git; reached callbacks reject explicitly empty names.

The shared `column-mode` grammar accepts only the source's exact space/comma
separated tokens, including empty lists. Its projection tracks the last explicit
enable word (`always`, `never`, `auto`) with a per-occurrence default of `always`.
`tag --column=never,row -n0` is allowed; `tag --column=row -n0` is rejected;
`-n-1` retains the native no-lines sentinel. `auto` depends on tty/pager state
and remains a native decision. Invalid column tokens are rejected before later
help, as in Git. The native callback grammar also applies to other generated
options using `parseopt_column_callback`.

Untracked-file modes are checked after option parsing. The shared source-backed
boolean profile accepts Git's boolean/configuration-integer spellings plus exact
`normal` and `all`. A false-valued spelling conflicts with status's
`--ignored=matching`; `--untracked-files=bad -h` reaches help. Repeated values and
negations retain native last-assignment behavior. Commit cleanup is likewise a
final rule, allowing `default`, `strip`, `whitespace`, `verbatim` and `scissors`,
including under `--dry-run`.

`node scripts/reference-parser-corpus.mjs --check` reproduces 9,805 independent
Git 2.55.0 outcomes. Native names supply deterministic prefix/negation candidates;
Git supplies every expected outcome. A seeded repository has staged changes
and valid object names `bad`, `1`, `-h`, `--`, and `file`, so consuming those
words is not mistaken for a universal syntax error. Runtime and compiler checks
cover every row. Compiler fixtures are deterministic shards of at most 400
cases, all compiled together with every source and other contract root in the
standard whole-contract project. No isolated compiler batches are used.

These checks do not establish completeness: repository/configuration effects,
nonempty object/ref resolution, tty-dependent columns, pathspecs, other callbacks,
completion and other native parser modes remain open. All scopes remain partial.

Cross-version native controls distinguish this final untracked-mode grammar from
the earlier boolean callback profiles. Git 2.25/2.47 reject configuration-integer
untracked modes such as `-2147483648`, which Git 2.55/2.56 accept; all four reject
`k`. The new final rule models the recorded modern grammar. Public argument
checks permit supported modern spellings while the selected executable retains
its own option availability, final status and diagnostics. The older generic
boolean unit grammar is not imported into this final untracked-mode rule.

Literal alternatives are checked universally through final rules: a column mode
`never | always` cannot be used with tag message lines because its `always` arm
is invalid. An actual early help exit exempts only that state from final rules;
a later `--no-column` can make all alternatives valid. Opaque strings and
non-singleton template keys defer to runtime, while a known NUL word anywhere
in the original tuple remains rejected before that deferral.

The reference corpus includes both an actual trailing LF and literal backslash/n
text as distinct untracked-mode inputs. The original escaped-text controls are
retained alongside the nine added LF cases.


## Checkout-family and reset operand boundaries

`checkout`, `switch`, `restore` and `reset` model their ordinary option pass
before the native operand consumer. Prefixes, clusters, unknown-option errors,
callback timing and help exits come from each command's source tables. Switch
and restore consume both end markers; all following words become literal
operands. Thus `restore -- -h` names a path and `switch -- main -h` has two
references, rather than requesting help.

Checkout and reset retain `--` but consume `--end-of-options` in the initial
pass. Their `remainingSeparator` metadata describes the separate operand phase:
checkout scans the whole retained stream for the first `--`; reset recognizes
one only at index 0 or 1. A recognized marker sets `hasSeparator`, divides
`operandsBeforeSeparator` and `pathsAfterSeparator`, and is excluded from operand
counts. Further markers are literal words. Reset's later marker is a path, so
`reset file other -- -h` does not have the same reference-arity error as
`checkout file other -- -h`. Reference/path resolution remains with native Git.

The same metadata drives runtime and literal TypeScript state construction.
Existing mode/path constraints run on the resulting state: `reset --hard -- -h`
and `checkout --detach -- -h` cannot treat the literal path as help to bypass
those constraints. NUL and token-shape checks still precede parser exits.


Reset can consume at most one retained word as a revision. When no marker is
recognized, two or more words therefore necessarily include paths. Declarative
arity rules reject such words with non-mixed modes or a pathspec file. A finite
40-case independent oracle checks explicit and late markers, mode selection,
pathspec-file input and help timing. Single-word ref/path resolution remains
native. This supplements the original 7,885-case option-pass corpus.

`node scripts/checkout-parser-corpus.mjs --check` reproduces 7,885 independent
native outcomes with tracked dash-prefixed files, valid dash-prefixed refs and
file-backed LF/NUL stdin. Author/committer dates are fixed so diagnostic commit
hashes also reproduce byte for byte. Deterministic compiler shards of at most 400 cases
retain every outcome; all fixture files compile together with all source and
other contract roots in the whole contract project. No isolated compiler batches
or per-run incremental batch cache are used. Repository
and configuration state, ref/path ambiguity, pathspec languages and files,
interactive modes, remaining callbacks and parser modes remain audit obligations.
All scopes remain partial.

Native controls preserve the older conflict callback timing: Git 2.25 displays
help for `restore --conflict=bad -h`, while Git 2.47/2.55/2.56 reject the earlier
value. Public types retain that supported older exit; the source-specific
corpus pins immediate validation and keeps the modern negative assertion.

The growing whole-project compiler check exhausted its unchanged 10 GiB heap
before a duplicate-profile retry was removed. That retry is skipped only when
all remaining scalar axes equal the already checked defaults; independently
selectable numeric/ABI/callback alternatives remain in place. All fixture files
and source roots stay in the same project, without restoring the old batch
runner or its incremental cache.


## Native aliases in clone, fetch and push

The long-spelling compiler models `parse-options.c:preprocess_options`,
`is_alias` and `register_abbrev`. An alias inherits its target's flags while
retaining its name and position in the option table. Native alias groups are
pairs of names: an alias and its target. Two aliases of the same target are
not automatically interchangeable for abbreviation ambiguity. Full parsed flags
must also match; the very-short negation path keeps OPT_LONG while the ordinary
path cancels it. Earlier unrelated ambiguity remains recorded, and an exact
match takes precedence. Missing targets and nested aliases are rejected as in
native preprocessing.

`clone`, `fetch` and `push` use their ordinary source tables before remaining
operands. `clone --recur -h` reaches help even though both `--recursive` and
`--recurse-submodules` match. `fetch --negotiation-t=HEAD -h` reaches help
through the `--negotiation-tip` alias of `--negotiation-restrict`. The shorter
`--negotiation-=HEAD` is still ambiguous because `--negotiation-include` also matches. `push --bra -h`
resolves the `--branches` alias, while an attached value such as
`--branches=1` still fails before help. Both end markers are consumed, and
following words become literal operands instead of callbacks or help tokens.

`node --test scripts/parse-option-long-forms.node-test.mjs` checks alias pair identity,
nontransitive relationships, parsed flags, sticky ambiguity, exact precedence,
inherited flags and native rejection of nested/missing aliases.
`node scripts/alias-parser-corpus.mjs --check` reproduces 9,997 independent native
outcomes and compiler assertions, with fixture files of at most 400 cases, all checked together with every other
source and contract root under the whole contract project limit.
The oracle uses fixed dates, a local remote with a configured upstream, and a
dash-named remote. Clone destinations are fresh; final push/fetch probes use
dry-run. No external network transfer is required.

Ref/refspec grammars and resolution, repository/configuration and transport state,
other callback languages, completion, platform profiles and other parser modes
remain open. Every scope remains partial.



### Checking rule requirements without repeating input state

Each non-exiting state is checked against the requirement of each rule. The
requirement is the same predicate shape used by `Constrained`; the validity
check compares the state with that shape directly instead of first intersecting
it with the entire state again. A state is already assignable to itself, so
this removes a redundant comparison without changing which rule outcomes pass.
The existing universal check across finite union alternatives, help exits,
independent parser profiles, original argv and all contract assertions remain.
The whole project continues using one compilation; see the current heap setting below.


### Ordinary history and reference inspection passes

Merge, rebase, for-each-ref and show-branch now resolve their recorded native
option tables before replaying reached callbacks and final constraints. Long
prefixes and short clusters follow the same source-backed spelling compiler.
Both end markers are consumed and the remaining words are literal operands.
Show-branch additionally stops at the first ordinary operand: in
`show-branch main --color=invalid`, the last word is a ref, so the color callback
is never reached. Whether that ref exists is left to Git.

Merge's reached message-file callback rejects an empty filename before help.
Nonempty file access remains native. Strategy names remain open because Git
looks up executable custom merge strategies; even an empty name can be supported
by an executable named `git-merge-` on PATH.

`node scripts/history-parser-corpus.mjs --check` reproduces 9,608 independent
Git 2.55.0 outcomes from native table prefixes, native negations, value suffixes,
short clusters, help ordering and selected final boundary/combination rules.
Fixed commit dates, valid dash-prefixed refs, readable message files and custom
strategy executables distinguish syntax from unknown repository/filesystem
state. Every row has a type assertion in files of no more than 400 outcomes; all files
compile together with the complete source and contract project under the existing
whole-project limit.
The corpus is finite. Branch merge configuration, rebase state/configuration
and trailers, show-branch configured default arguments, ref/format/path/file
resolution, completion, other platforms and other parser modes remain open.
All command audit scopes remain partial.



### Reference subcommands and signature parser passes

All five refs subcommands (migrate, verify, list, exists and optimize), show-ref,
symbolic-ref, verify-tag and verify-commit now use their recorded ordinary option
passes. Both end markers are consumed; remaining words are literal operands.
KEEP_ARGV0 in verification commands is internal bookkeeping and does not count
as a public operand. Refs list reuses the for-each-ref table and color grammar.

The native table owns short-option lookup before internal help. Show-ref's -h
is its HEAD display flag, including inside clusters; it cannot suppress later
errors or final arity/mode checks. Its parser exits use a separately declared
internal help spelling. The deterministic compiler selects the first declared
exit spelling outside Git's excluded first-argument dispatcher position. The
generator rejects a pass that has no such spelling. Explicit show-ref hash
lengths reuse the source-audited abbrev callback grammar via hash_callback.

`node scripts/ref-subcommand-corpus.mjs --check` reproduces 3,938 independent
Git outcomes, each with a compiler assertion in files of at most 400 cases; all
files compile together with the complete source and contract project under the
existing whole-project limit.
The oracle supplies valid dash-prefixed refs, including --help-all when a
required callback consumes that word as its value. It classifies only grammar
and selected final constraints: repository/keyring signature results, storage
configuration, ref/format/stdin languages, parent refs dispatcher paths,
completion and other modes remain separate obligations. All scopes are partial.

### Whole-project heap for the reference subcommand corpus

The complete project, including every native assertion, exceeded the former
10 GiB V8 heap and aborted. Diagnostic execution with an 11 GiB heap completed
with zero type errors: 226,279 TypeScript lines, 95,764,483 instantiations and
11,193,647 KiB reported compiler memory, in about 17 minutes. Three measured
implementation optimizations did not improve the focused baseline and were
removed. No contract cases or source roots were removed.

At that stage the standard command changed to `--max-old-space-size=11264`. It still checks all
source and contract roots in one project, without a batch runner or incremental
contract cache. This repository is public and its typecheck job uses
`ubuntu-latest`, for which GitHub documents 16 GB RAM:
https://docs.github.com/en/actions/reference/runners/github-hosted-runners .
The diagnostic pass is evidence of local compilation; the new standard command
also requires actual success on the PR's CI head before merge.

The reference-command parser exit metadata also lists `--help-all` explicitly.
The existing first internal spelling and dispatcher exceptions are unchanged.
Eighteen structured-token controls supplement the original unchanged 3,920
native outcomes, and all eight additional public `--help-all` declarations have
positive compiler checks. Show-ref's HEAD/hash-specific audit note appears only
in its own audit row.


### Mandatory parse-options subcommands

The refs root records mandatory OPTION_SUBCOMMAND selection in its ordinary
parser pass. Its dispatch dictionary must exactly match the pinned native table.
This initial mandatory profile has no parent callbacks; shared parent/child
callback state requires a separate audited transfer model. The parser selects
an exact operation name and stops immediately; an unknown
operand errors before later help. Either end marker or exhausted argv before
selection errors because the subcommand is required. Operation names also take
part in native single-dash typo detection. These are ordered parser transitions,
not final operand-count rules.

The selected child schema parses the retained words and checks its callbacks and
final rules. `refs list --count=bad -h` fails in the reached count callback;
`refs list --shell --python -h` exits before incompatible quote styles are checked.
Both the root command API and the operation-specific API share those child
constraints. A parent help exit preserves ignored child tuples using a generated
serialization dictionary; that dictionary does not make child options valid
before selection. The generator rejects conflicting serialization definitions
and unaudited child parser passes. Literal unions retain invalid parser outcomes
rather than erasing them through an accepted union member. Broad runtime strings
and the established compiler budget continue to defer to runtime validation.

Git's global `--help` rewrite is limited to the first word after the top-level
command. Therefore the five refs child passes do not exclude their own first
`--help`: `refs verify --help` is an internal parser exit even when represented
as an operand token. The root's global first `--help` remains delegated.

`node scripts/mandatory-subcommand-corpus.mjs --check` reproduces 614 independent
Git outcomes for prefixes of every refs operation, unknown/typo words, both
boundaries, help ordering and selected child callbacks/final rules. The fixtures
use a fixed-date isolated repository and known fully qualified refs. Ref existence
and storage operations are not inferred from grammar alone. Global help tools,
completion, configuration, all ref/format/stdin languages and repository state
remain open; the finite corpus does not prove completeness. All audits stay partial.

Mandatory parent validation retains its original tuple and selected grammar
context. The child receives the same context while parsing precisely the argv
retained after native subcommand selection. Runtime dispatch also retains the
selected ABI and frontend profiles. The refs parent has no callbacks, so this
profile does not imply an unaudited transfer of parent callback state.
A count-before-help regression checks that explicit bounded integer parsing
rejects a reached overflow while the narrowing profile preserves its supported
help path through both direct child and parent APIs. Native controls distinguish
older integer implementations and older binaries without the refs operation.


### Native parse-options completion exits

The source-audited initial parser scopes recognize `--git-completion-helper` and
`--git-completion-helper-all` only as a single remaining word at that parser's
entry, including audited intermediate wrappers. These spellings retain their
original serialized argv. Attached values, repetitions and option boundaries do
not acquire a general help exemption.

For the audited retained ONE_SHOT diff parser, a final completion word can exit
before the final unknown-revision-option usage check. Callbacks reached before
that exit still validate their values; an earlier invalid callback remains an
error. Parent and child passes retain the selected ABI and grammar context, and
trait discovery reads the same pre-exit tokens.

The independent Git 2.55.0 corpus records 990 finite outcomes across 51 scopes,
including valid stash/ref context, tuple and operand spellings, help ordering,
mandatory refs children and retained revision options. Its compiler assertions
pin the observed modern parser profiles. This finite evidence does not establish
all argv, repository, platform or interactive behavior; all scopes remain partial.


### Native filename parser profiles

`OPTION_FILENAME` updates differ across the observed Git sources. Git 2.25.1
keeps an empty filename as a nonnull pointer and clears it on negation; Git
2.47.3 clears empty and negated values. Git 2.55.0/2.56.0 clears empty values,
retains the earlier pointer on negation, and recognizes `:(optional)` filenames.
A missing optional path retains the earlier value rather than clearing it.
Other stat failures, including ENOTDIR and EACCES, retain native diagnostics.

The runtime observes the selected executable with read-only `tag --list`
controls and checks optional paths without reading command stdin. Each lookup
is preceded by the existing ABI/callback validation up to that filename update.
Callbacks reached before an optional stat still validate; a stat failure before
a later callback remains a native error. Unknown frontends retain native parsing.
The original command environment and serialized argv are preserved.

Literal checking retains observed parser alternatives and independently unknown
optional path states. It checks the complete input in each alternative so a
valid optional arm cannot hide a guaranteed-invalid ordinary filename arm.
Repository/filesystem state remains a runtime obligation. These finite source
and native controls do not establish complete command coverage.


### Whole-project heap for filename profile alternatives

Three actual whole-project runs exhausted the 11 GiB heap. The retained type
refinements avoid filename retries for ordinary updates and preserve the existing
state calculation for other options. A precomputed command-union experiment
produced TS2590 and was reverted. No fixtures or source roots were removed.
A 12 GiB diagnostic run completed all 558 files, reporting 108,464,256
instantiations and 11,721,552 KiB compiler memory in 1,307.01 seconds. It failed
two stash assertions, so it was not a successful typecheck. Those assertions
used Git 2.55.0 outcomes without pinning its filename profile and could borrow
legacy empty-filename semantics. The generator now pins that source profile;
all 4,978 regenerated native outcomes remain unchanged, and the focused compiler
check including every stash assertion succeeds.

The standard command uses `--max-old-space-size=12288` to retain the complete
source/contract project. The repository is public and the typecheck job uses the
16 GB `ubuntu-latest` runner documented above. Fresh success of the standard
command locally and on the exact PR head is required before merge. A diagnostic
run or a failed standard run is not counted as that success.


The fresh standard 12 GiB check succeeded with all 558 files and 231,693
TypeScript lines: 108,089,458 instantiations, 12,134,386 KiB reported compiler
memory and 1,238.48 seconds total. This is local compiler evidence; exact-head
CI and review remain separate merge gates.


Pinning `filenameProfile: 'optional'` selects the parser generation, not path
existence. Unless `filenameIgnoredValues` is supplied explicitly, optional path
states remain unknown and are explored independently. Windows Git can report
`file/child` beneath an ordinary file as missing rather than ENOTDIR; native
comparison tests retain its later callback/syntax errors instead of assuming the
Unix stat diagnostic. The path is not read from command stdin.
