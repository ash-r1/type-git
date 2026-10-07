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

Git boolean parsing includes signed, base-0 integers and unit suffixes. The current Git 2.55 test environment accepts C23 binary literals; older libc implementations may reject that spelling. This is a version/platform boundary, not a claim of identical parsing on every supported Git installation. The independent scalar test explicitly verifies that an installed non-C23 parser rejects `0b1` while the recorded default profile accepts it; all other cases continue to be compared normally. A passing cross-platform suite therefore does not establish binary-literal conformance on that native profile. Arbitrary callback languages, configuration, protocols, binary I/O, and remaining commands are still tracked as incomplete in the coverage ledger.
