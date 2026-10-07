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

### Commands delegating revision and diff parsing

Backfill rejects explicit merge-diff selections, including `--no-diff-merges`,
and preserves accumulating diff filters even when followed by an empty filter.
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
Tests create local pack fixtures and compare their native parsers. Full streaming
and numeric callback grammars, configuration/path-walk overrides and binary
output API contracts remain pending; these scopes are not marked complete.

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

Recursive merge aliases require exactly two heads after `--`; excess bases are
accepted with Git's warning rather than capped by the schema. Strategy flags
retain last-selection behavior. Merge-index preserves its native argument-word
minimum, including a no-work `-o <program>` invocation; its positional prefix
interpretation and index-dependent program calls remain pending.

Difftool's explicit GUI/tool/extcmd choices conflict, but mergetool has no such
blanket restriction. Difftool tool-help returns before deferred diff parsing and
final tool selection checks, so inherited immediate diff callback restrictions
are not imposed on that path. Complete delegated diff phase validation remains
pending. Request-pull accepts interleaved patch selection and ignores words after
the optional end ref; tests resolve only local fixture refs.

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
source branch. The Linux fixture binary does not implement the daemon; these
scopes have model/compiler checks and an explicitly skipped native-platform
comparison, rather than a claim of successful native lifecycle validation.

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

### Native fallback dispatch

`config`, `stash` and `reflog` declare exact first-word dispatch targets. An initial operand such as `{ operand: 'get' }` selects its child schema before any fallback callbacks or rules run. A preceding option or separator stays in the fallback grammar. The generator verifies every target against the catalogue and emits the dispatch map in the exploration report; each branch retains its own finite normalized-state exploration.

Legacy config modes derive implicit get/set/set-all from operand count, preserve immediate command-mode conflicts, and constrain display modifiers, value patterns and write destinations. Legacy `--edit` ignores extra operands, while modern `edit` rejects them. Reflog `exists` similarly ignores extra operands. Implicit stash requires a separator before non-patch paths; explicit `stash push` has its own parsing behavior.

`stash list` returns before delegated log parsing when no stash ref exists. Its current schema therefore accepts literal argument words rather than claiming unconditional log-option validation. Repository-state-dependent delegation and the inherited revision callback phases remain audit gaps. Root scopes and their children are partial, not complete.

### Standalone upstream programs

`scalar`, its ten operations, `gitk` and `gitweb` use explicit executable metadata. They run their own programs rather than inserting the name after `git`. Configure their locations with `companionBinaries: { scalar, gitk, gitweb }` in the Git constructor; defaults are `scalar`, `gitk` and `gitweb.cgi` on PATH. A custom `gitBinary` still selects Git itself; companions select their child Git processes according to their own native behavior.

The shared runner preserves environment inheritance, HOME, PATH prefixes, credential overrides, standard input, abort signals and audit events. Worktree and bare repository handles supply the child working directory without changing the parent process directory. Raw Git execution retains its existing behavior.

Scalar schemas preserve operation arities, its fixed run-task vocabulary, and the fact that reconfigure's maintenance mode is validated only in the `--all` branch, after option replacement. Parent `-C` and `-c` tuples on an operation scope are serialized before its command word. Gitk's own select/argument-command options are typed; delegated revision words remain literal operands. Gitweb's FastCGI selectors and process count are typed without inventing range restrictions. GUI execution, missing CGI/FCGI dependencies, configuration-dependent behavior and remaining delegated grammars are explicit audit gaps.


### Shell frontends and libraries

Filter-branch's long option values remain separate argv words; prune-empty conflicts even with an empty explicit commit filter. Quiltimport accepts trailing words after its parseopt phase. Instaweb action selectors replace each other, and every positional action word must belong to its shell cases. The shared `elements` constraint checks array membership in a finite vocabulary in both runtime and TypeScript; the decision diagram explores deterministic representatives including mixed valid/invalid arrays.

Git-shell supports interactive mode, one `-c` command string, or its single `cvs server` compatibility word. Custom commands under `git-shell-commands` mean its command language cannot be restricted to the three built-in Git services.

Git installs `git-sh-i18n` and `git-sh-setup` without executable permissions for sourcing by other shell scripts. Their standalone typed command API is marked inapplicable rather than generating invalid `git sh-i18n`/`git sh-setup` invocations. Their setup and function semantics remain subject to audit through callers; native tests source the installed libraries in isolated child shells.

Implementation classes reference `GitCommandClient['command']` directly in their declarations. This avoids expanding the complete command union independently in each class during declaration serialization. Dispatch type checks expand child option languages only for dispatching command names.

### Arch and CVS frontends

Archimport's implemented Getopt string omits `-o` despite its usage text advertising it. CVS import takes at most one module and accumulates `-M` values; its numeric-looking values remain strings. CVS export consumes the final two operands without rejecting earlier words. CVS server requires explicit export roots before environment fallback, while version exits before that check. These rules follow the source parser, not a reconstruction from usage text.

Native tests stop at parser or local checkout validation boundaries without contacting Arch/CVS services. CVS server is explicitly skipped when its DBI dependency is unavailable. Service protocols, configuration-derived requirements and remaining parser languages are still pending.

### Send-email phases

The identity pass precedes alias inspection, which rejects ordinary send options and remaining words. Main options are then parsed before final suppression and confirmation checks. Confirmation accepts native prefixes such as `never-trailing`; an earlier invalid value can be replaced before that check. Completion output returns before final suppression validation. The schemas preserve those phases and keep configuration-supplied dependencies open: a CLI relogin delay can obtain its batch size from config.

Tests inspect aliases or use `--dry-run` on locally generated patches. They do not deliver messages. Address/message validation, encoding, transport state and format-patch delegation remain pending.

### GUI operation schemas

The catalogue includes `gui`, `citool`, and GUI's five explicit dispatch targets: gui, pick, citool, browser and blame. UI commands consume no remaining operands. Browser and blame accept a required path and an optional revision; an explicit separator immediately precedes the path. Blame's numeric line selector precedes both. A filename such as `--line=2` remains expressible as a literal operand.

These constraints come from the pinned Tcl source. Schema/compiler tests are complemented by version execution and native X11 argument failures under Xvfb. Global trace-removal edge cases, discovery, path/object checks and UI state remain audit gaps; these scopes are not complete.
The build emits declarations once with TypeScript and then bundles the emitted files, keeping source checking and declaration bundling in separate phases. Declaration emission uses `--noCheck`; `pnpm typecheck` still performs full source and contract checking, and `prepublishOnly` runs it before publication. Packed ESM/CJS and TypeScript consumer tests cover the final artifacts. Root dispatch type checks retain direct schema lookup to avoid distributive expansion across every command during inference.

GUI version calls run through the shell prelude without Tcl/Tk. Native X11 tests under Xvfb cover argument errors; child operations do not inherit an unsupported `--help` shortcut. Browser/blame can have empty revision words, so positional maxima are not inferred from the synopsis alone; overall argv bounds remain modeled.

### Perforce operation extraction

`scripts/extract-p4-options.py` reads the pinned upstream Python AST without executing git-p4, including its command registry, class inheritance and optparse declarations. The checked-in snapshot contains the source hash. Run it with the upstream source directory and `--check` to reproduce the extraction. Runtime and TypeScript schemas are generated from that snapshot plus reviewed operation rules.

Submit and commit accept at most one branch, unshelve requires one changelist, and clone requires depot input. Keep-path needs a nonempty explicit destination before positional destination inference. Choices fail during parsing; every accumulated update-shelve number must be positive after parsing. The shared `eachInteger` constraint checks these arrays at runtime and in deterministic decision diagrams; arbitrary numeric range proofs remain outside TypeScript's literal checks.

Native tests use help, empty local branch listings and parser/local failures with constructor-only Perforce capability probes served by a local fail-closed stub. Perforce/configuration-dependent synchronization and submission, depot languages, exclusion normalization, and option abbreviation remain audit gaps.

### Subversion operation extraction

`scripts/extract-svn-options.py` extracts the pinned git-svn registry, shared option hashes and final global declarations without loading upstream Perl code. The snapshot records source version/hash and declarations. There are 25 registered operations plus the root scope. Global `id|i=s` overrides dcommit's short interactive alias; mixedCase configuration-only fields are removed before CLI parsing. Log and blame allow delegated words as literal operands.

Rules preserve required names/property values, fetch/info operand limits, ignored surplus words, and explicit message/file and initialization-metadata conflicts. Find-rev accepts before and after together (before wins). `svn.*` configuration can supply operation inputs, including revision and layout: the CLI schema deliberately does not require those options to appear in argv.

Native SVN tests cover every operation help grammar and isolated file:// repository workflows, including configuration-supplied revision. Tests explicitly skip when SVN Perl bindings are unavailable; schema/compiler checks remain separate evidence. Exact first-operand dispatch is covered. Git-svn's whole-argv command scan (including option-value words), delegated log/blame grammars, config/remote state and value languages remain incomplete.

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

The shared `object-filter` scalar parser models `list-objects-filter-options.c`, `parse.c`, `object.c`, and `url.c` from Git 2.55. It validates blob limits, tree depths, object types, sparse object references, and nested combined filters. Base-0 numbers and k/m/g suffixes follow the current 64-bit unsigned-long/libc profile. `sparse:oid=` accepts even an empty name at this stage; object resolution remains Git's responsibility. Combined filters discard empty components, reject unescaped reserved bytes, and percent-decode each component before parsing it. Malformed percent escapes and `%00` remain literal, as in Git.

Clone and fetch enable `auto`. Their shared option group contains before-token constraints and ordered state effects. Auto cannot coexist with any other positive filter, including another auto. Clearing permits a new choice, but an implicit conversion from a simple filter to a combined filter clears Git's `allow_auto_filter` flag permanently. An explicitly supplied `combine:` does not make that conversion. The schema preserves this observable difference, including after `--no-filter`.

Native tests cover all seven direct parse-options callback tables, the manual fetch-pack parser, and rev-list's revision parser. They enumerate every sequence of length one through four over `{blob:none, combine:blob:none+tree:1, auto, --no-filter}` for both clone and fetch, with longer reset witnesses. This is deterministic bounded sequence coverage, not an exhaustive proof for arbitrary argv or repository state. Type fixtures check grammar literals, conflicts, reset behavior, and the persistent native state change. `node scripts/object-filter-corpus.mjs --check` independently regenerates 1,331 Git callback outcomes on the pinned Git 2.55.0 LP64/unsigned-char profile. The corpus covers every percent-encoded byte in lowercase and uppercase in three contexts, raw ASCII control characters, integer/radix/unit boundaries, and nested decoding witnesses. Checked-in compiler assertions and runtime tests consume those native outcomes; this is a finite corpus, not exhaustive coverage of all filter strings.

The grammar also propagates to scopes that inherit revision options. Those commands' preprocessing/help timing still needs separate auditing: for example, log handles `-h` before revision callbacks. Convenience-method filter validation is also shared through final scalar rules (below). TypeScript checks unsigned-long bounds (including radix and unit multiplication) using the shared native integer literal parser. Combined literals follow the same split, reserved-byte check, percent-decode, and recursive parse order. The generated byte table preserves malformed escapes and `%00`. To avoid rejecting valid inputs due to compiler recursion limits, dynamic values and walks beyond 128 decode steps, 128 sibling components, or 32 nesting levels retain runtime validation. Native 32-bit unsigned long, older libc binary-number support, and signed-char rejection of non-ASCII bytes remain explicit platform gaps; the default runtime grammar uses the pinned aarch64 Linux profile. All affected command audits remain partial.

## Final scalar constraints

A `scalar` constraint associates a normalized option key with one of the shared value parsers. Runtime validation and the finite-domain decision diagram both evaluate that declaration. This supports values that Git checks after parsing: an invalid earlier value can be overwritten or cleared before a final rule runs. Immediate option callbacks retain their separate before-token validation.

Clone and fetch check their final depth with `atoi`, before transport-specific parsing. The pinned Linux libc profile converts the decimal prefix to a signed long (clamping overflow) and then to a signed 32-bit integer. Consequently, `2147483648` fails this check while `4294967297` and `-4294967295` pass. The shared final rule preserves those results in CLI and convenience APIs. `1suffix` also passes this initial stage; a transport may reject it later. Native tests use fetch with no remotes to isolate the initial stage, and actual local clones to verify wrapped numeric values. Transport-specific checks and other libc/data-model profiles remain open.

The clone and submodule-update convenience methods now use the shared object-filter grammar before spawning Git. Their non-generic option objects retain broad string fields, so those value grammars are checked at runtime. The generated compiler fixtures deliberately project out scalar and numeric checks that broad public property types cannot express. Generic literal command arguments retain their existing grammar checking, and exact finite-domain counts still include scalar rules. Representative scalar values are explicitly recorded, including valid forms and overflow boundaries; these are bounded domains, not complete string languages.

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
parser `{ kind: 'integer', signed, bits }`. Git 2.55 rejects overflow immediately,
even before a subsequent overwrite or parse-options `-h` token. Negation assigns zero where
supported; optional values use the evaluated defaults (for example, merge log
length 20 and show-branch `--more` 1). This parser is distinct from clone/fetch's
initial `atoi` depth check and from bespoke callbacks.

Values may be safe integer numbers, bigint values, or native strings. Strings
preserve base-0 decimal/octal/hexadecimal/C23 binary notation, ASCII leading
whitespace, signs, and case-insensitive `k/m/g` units. Unsigned options reject
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
and exercise immediate validation across the generated numeric options.
Command-specific semantic restrictions, callback-defined numeric languages,
configuration-derived defaults, platform differences, and preemptive help paths
remain separate audit work. All command audit entries remain partial.

## Numeric callback conversion stages

`spec/git-numeric-callbacks.json` separates callback semantics from the native
integer table handlers. Its source-audited profiles record strict decimal syntax,
LP64 `strtol` overflow saturation, checked or cast 32-bit storage, signedness,
empty values, and checks before/after conversion. Source fingerprints include the
implementations and storage/default declarations. This is an explicit source
audit, not automatic discovery of every C callback. The generated profile module
also supplies the `cherryPick` and `revert` convenience-method mainline rules.

For example, `--mainline=4294967297` and `--mainline=-4294967295` both narrow to
one. `--mainline=2147483648` becomes negative and fails. Native parse-options
integer handlers instead reject overflow and accept base-0/unit spellings.
Revision counts use strict decimal checked integers; tab widths and apply strip
counts add a nonnegative check. Diff context checks negativity before narrowing to unsigned
storage, whereas grep context can narrow a negative int into unsigned context.
The abbreviation callback clamps nonzero results below four after conversion.
The separate revision parser's permissive `--abbrev` handling remains distinct.

Numbers, bigint values, and strings use the same declared profiles. Literal
TypeScript normalization uses deterministic decimal subtraction/modulo tables;
invalid literal unions are rejected, while dynamic inputs and very long strings
receive runtime scalar validation. Symbolic number/bigint slots inside numeric
strings also defer to runtime, including templates with a fixed prefix or unit
suffix; a known invalid prefix is still rejected. Numeric shorthand preserves digit strings
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

## CLI string representation

NUL cannot be represented inside an OS argument string. This is a transport
restriction, independent of Git's command-specific parsing and help behavior.
`ARGV_STRING_CONSTRAINT` records this wrapper representation rule once in the
command schema, with its reason and provenance. Runtime and literal checks use
its forbidden character. The typed command API checks literal tuples before
dispatch and rejects known NUL bytes in option values or operand objects,
including literal unions and templates with a known NUL. Each tuple position is
checked independently so another dynamic string cannot hide a known NUL. The existing runtime builder checks the same
representation boundary for dynamic inputs. Broad strings and arrays with
unknown length retain runtime validation. Stdin is a data stream and continues to
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
The annotation is deliberately per scope: `grep -h` is an ordinary option, `log`
has an earlier parsing pass than its diff options, and `diff-files` processes
those options before handling help. Their exit phases, completion helpers,
abbreviations, repository/configuration failures and other parse exits remain
separate audit obligations. All command audit entries remain partial.

## Boolean callback profiles

`spec/git-boolean-callbacks.json` records Git's textual boolean names, signed
32-bit integer parser and five callback profiles. Generated constants are shared
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

Both profiles use LP64 `strtoul` semantics through the shared decimal parser.
Negation occurs in unsigned long, while magnitude overflow saturates at
`ULONG_MAX`. Shortlog then checks `INT_MAX`; show-branch stores an int before its
later fallback logic. Thus `-18446744073709551540` becomes width 76, but
`-18446744073709551616` saturates and fails shortlog's range check. A trailing
newline is an unconsumed character in a numeric field; a newline after reflog's
comma belongs to its opaque tail and is accepted by this callback.

Compiler checks consume the same profiles and numeric conversion rules, including
field defaults and width/indent comparisons. Symbolic values and bounded numeric
walks retain runtime checks without hiding another field's known violation.
Shortlog's parse-options/revision-option loop processes unknown options inline,
so its help exit is ordered, unlike log's separate early parsing pass. Shortlog
also uses the shared color callback grammar.

`node scripts/compound-decimal-corpus.mjs --check` reproduces 873 independent
numeric outcomes and seven ordered help/color cases across finite tuple
combinations, numeric boundaries, whitespace and comma tails. This does not prove every platform, repository condition
or unbounded input language complete. All command audit entries remain partial.
