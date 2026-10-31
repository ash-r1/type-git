# type-git

## 0.6.0

### Minor Changes

- [#188](https://github.com/ash-r1/type-git/pull/188) [`a1c421e`](https://github.com/ash-r1/type-git/commit/a1c421eb06a7d49dfa4e84cbbd9a125d94d0c390) Thanks [@ash-r1](https://github.com/ash-r1)! - Model native clone, fetch and push option passes, including Git's pairwise alias handling in long-option abbreviation. Preserve target flags, exact-match precedence, sticky ambiguity, negation and help timing in deterministic generated spelling tables shared by runtime and literal TypeScript checks.

- [#171](https://github.com/ash-r1/type-git/pull/171) [`7ac405b`](https://github.com/ash-r1/type-git/commit/7ac405ba974b278017b2579ac78ccac3fcff8bba) Thanks [@ash-r1](https://github.com/ash-r1)! - Reject NUL-containing literal CLI arguments in the typed command API, including values, operands, literal unions, help calls, and dispatched subcommands. These strings cannot be represented in OS argv; dynamic inputs keep runtime validation.

- [#182](https://github.com/ash-r1/type-git/pull/182) [`18e3d5f`](https://github.com/ash-r1/type-git/commit/18e3d5faf249b6ac65c5963f71e519f16ef604c6) Thanks [@ash-r1](https://github.com/ash-r1)! - Model Git's assumed stash push parser and retained path boundaries in runtime and literal type validation. Preserve native subcommand-name typo checks before fallback help, including reflog prefixes. Compare both interpreters against expanded independent Git corpora.

- [#148](https://github.com/ash-r1/type-git/pull/148) [`92c00c9`](https://github.com/ash-r1/type-git/commit/92c00c950dc5f2e92365148c98ec11b3a2186740) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed bisect operations and custom-term constraints. Compare final option values through a shared declarative equality predicate, deterministic exploration and literal TypeScript validation, while preserving custom dispatch and native delegated arguments.

- [#173](https://github.com/ash-r1/type-git/pull/173) [`e431b48`](https://github.com/ash-r1/type-git/commit/e431b486d76a62779d371f173ea255495f12a058) Thanks [@ash-r1](https://github.com/ash-r1)! - Share declarative boolean callback profiles between runtime validation and compiler literal checks. Apply signed integer bounds, callback-specific names and normalized values to submodule recursion, signed push and pull rebase options. Reject Unicode case-fold lookalikes that native Git does not accept.

- [#180](https://github.com/ash-r1/type-git/pull/180) [`70562eb`](https://github.com/ash-r1/type-git/commit/70562eb6321c2ba377ab2e32cc5e95ce0d4a52b7) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed log options to stash list and model its repository-conditioned child invocation. Validate the unconditional parser while preserving Git's success when no stash exists, and defer child value/combination checks until native execution determines the repository state.

- [#187](https://github.com/ash-r1/type-git/pull/187) [`10170ca`](https://github.com/ash-r1/type-git/commit/10170cae10e8f3e75b8339cab9d2074f232f0fa6) Thanks [@ash-r1](https://github.com/ash-r1)! - Model native checkout, switch, restore and reset option passes before their operand consumers. Preserve checkout/reset's distinct retained separator rules in declarative metadata, runtime validation and TypeScript literal checks while allowing ordinary native abbreviations, clusters and help exits.

- [#181](https://github.com/ash-r1/type-git/pull/181) [`21cc529`](https://github.com/ash-r1/type-git/commit/21cc52991342bbf2a192e664a0d56aea41d777a9) Thanks [@ash-r1](https://github.com/ash-r1)! - Model native option parsing for eight stash subcommands, including long-name abbreviations and ambiguity, short clusters, help timing, unknown-option policies, separator retention and literal remaining operands. Share source-generated spelling tables between runtime and literal type checks.

- [#157](https://github.com/ash-r1/type-git/pull/157) [`519fb02`](https://github.com/ash-r1/type-git/commit/519fb02bccbbe22cedc9f9f9ac073b971b1bb2bc) Thanks [@ash-r1](https://github.com/ash-r1)! - Execute Scalar, gitk and gitweb through their standalone programs with configurable paths, preserving repository context, environment, audit and cancellation. Add Scalar's ten operation schemas, conditional maintenance validation, and GUI/CGI argument entrypoints.

- [#174](https://github.com/ash-r1/type-git/pull/174) [`e1e5b22`](https://github.com/ash-r1/type-git/commit/e1e5b224c62e5ad61564c894a03ee583dad7013e) Thanks [@ash-r1](https://github.com/ash-r1)! - Match Git's compound decimal callback grammar for shortlog wrapping and show-branch reflog parameters. Share LP64 unsigned-long negation and saturation rules between runtime and literal checks, reject unconsumed numeric newlines, and preserve shortlog's ordered help exits and delegated color callback behavior.

- [#133](https://github.com/ash-r1/type-git/pull/133) [`03d1c11`](https://github.com/ash-r1/type-git/commit/03d1c1159f0a084a1b98b7ee14f1a1ed394c71df) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed CLI scopes for seven config subcommands, notes and its ten operations, and stash create. Follow Git's parser termination rules, preserve dash-prefixed literal config values and stash messages, validate immediate config type transitions, and position inherited notes options before the subcommand.

- [#144](https://github.com/ash-r1/type-git/pull/144) [`b0218f0`](https://github.com/ash-r1/type-git/commit/b0218f038953b96a117e6225b20633fb79adce00) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed scopes for backfill, last-modified, diff-pairs, range-diff and replay. Preserve native command defaults, protocol requirements, sticky diff filters, target selection and delegated diff/revision rules.

- [#156](https://github.com/ash-r1/type-git/pull/156) [`be8c221`](https://github.com/ash-r1/type-git/commit/be8c221c6dabe742cb89da2a71dd2ffab413acb4) Thanks [@ash-r1](https://github.com/ash-r1)! - Model exact first-word subcommand dispatch and the legacy config, implicit stash and default reflog grammars. Apply child constraints only after native dispatch; preserve ignored legacy edit/exists operands and defer repository-dependent stash list parsing.

  Preserve the existing façade command overloads, including text and byte output, while adding dispatch-aware argument checking.

  Emit declarations before bundling and retain separate full typecheck/prepublish validation to keep catalogue growth from exhausting declaration-bundler memory.

- [#167](https://github.com/ash-r1/type-git/pull/167) [`25b6b43`](https://github.com/ash-r1/type-git/commit/25b6b43d665e356be73f16f888e9ad9747d09f59) Thanks [@ash-r1](https://github.com/ash-r1)! - Share final scalar validation between declarative rules, runtime checks, and deterministic finite exploration. Validate filters in clone and submodule-update convenience methods and preserve Git's signed integer conversion and overwrite behavior for clone/fetch depth options.

- [#159](https://github.com/ash-r1/type-git/pull/159) [`5bbe8da`](https://github.com/ash-r1/type-git/commit/5bbe8da5494eba3f06e312e5152fa7647582e595) Thanks [@ash-r1](https://github.com/ash-r1)! - Add Arch/CVS frontend schemas from their implemented Perl parsers, preserving string values, ignored excess export operands, explicit server export roots and version early returns.

- [#161](https://github.com/ash-r1/type-git/pull/161) [`fbce995`](https://github.com/ash-r1/type-git/commit/fbce995e19974e3b9d0e60d9662e659d869aca84) Thanks [@ash-r1](https://github.com/ash-r1)! - Add the GUI and citool entrypoints plus all explicit GUI operations. Model UI operand counts and blame/browser ordering from their Tcl source, retaining explicit native-validation gaps for headless environments.

- [#154](https://github.com/ash-r1/type-git/pull/154) [`b250b78`](https://github.com/ash-r1/type-git/commit/b250b7821b4ccc7dd62996369dfa248c23ca7438) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed help and daemon grammars plus all fsmonitor daemon operations. Preserve native listing modes, explicit negative selectors, service prerequisites and platform-specific support boundaries.

- [#189](https://github.com/ash-r1/type-git/pull/189) [`2c98981`](https://github.com/ash-r1/type-git/commit/2c989816501440a1ecb8ad9693ea3b340e0a1544) Thanks [@ash-r1](https://github.com/ash-r1)! - Model native merge, rebase, for-each-ref and show-branch option passes, including prefixes, consumed end markers, reached message-file checks and literal refs after show-branch's first operand.

- [#143](https://github.com/ash-r1/type-git/pull/143) [`ccb1842`](https://github.com/ash-r1/type-git/commit/ccb1842ac1ec42639de3d352d77b5fbd5c8d2374) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed rev-list, bundle operations, history rewriting and repository inspection scopes. Preserve native missing-object action transitions and shared case-insensitive diff algorithm names, including default.

- [#155](https://github.com/ash-r1/type-git/pull/155) [`3f3c59b`](https://github.com/ash-r1/type-git/commit/3f3c59b41b8be7c89e0676093ddb2b8665ba2570) Thanks [@ash-r1](https://github.com/ash-r1)! - Add fast-import, HTTP fetch/push/backend and IMAP send command schemas, preserving native callback timing, import signature modes, CLI marks repetition and input arities. Extend declarative numeric ranges with optional upper bounds for immediate validation and deterministic exploration.

- [#150](https://github.com/ash-r1/type-git/pull/150) [`7bd9a48`](https://github.com/ash-r1/type-git/commit/7bd9a48972f8b9a104a7a191755c4256c7cb2c2b) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed update-index and fast-export scopes. Validate remaining arguments at native callback boundaries, preserve callbacks consuming literal words, and model index versions, chmod, export modes and anonymization prerequisites.

- [#140](https://github.com/ash-r1/type-git/pull/140) [`00bcf72`](https://github.com/ash-r1/type-git/commit/00bcf72144f346310635dcf1afc25b9b72ae33ac) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed CLI schemas for update-ref, checkout-index, read-tree, merge-file and merge-tree. Preserve native callback ordering, operand limits, last-wins merge choices and original-token restrictions in trivial merge mode, using a shared array-cardinality predicate.

- [#138](https://github.com/ash-r1/type-git/pull/138) [`104a406`](https://github.com/ash-r1/type-git/commit/104a406cfc7a815b846f411c53b657be7203d5b1) Thanks [@ash-r1](https://github.com/ash-r1)! - Add 25 typed file, reference and object inspection commands with declarative operand partitioning, native format modes, sort defaults, and conditional describe delegation. Preserve ignored native operands instead of imposing documentation-only arity limits.

- [#165](https://github.com/ash-r1/type-git/pull/165) [`bfca02a`](https://github.com/ash-r1/type-git/commit/bfca02a8a95e0d851604cd7c092450e6874a1fc5) Thanks [@ash-r1](https://github.com/ash-r1)! - Include LFS's two dynamically registered Cobra completion helpers in the upstream inventory and typed CLI. Extract their argument grammar from the pinned dependency, preserve literal completion inputs, and verify dependency source fingerprints during reproduction.

- [#139](https://github.com/ash-r1/type-git/pull/139) [`64276e9`](https://github.com/ash-r1/type-git/commit/64276e9a1719c397239db4657b4a585e996b6e03) Thanks [@ash-r1](https://github.com/ash-r1)! - Add 26 typed maintenance, storage and ref command scopes with Git-derived operand and combination rules. Model case-sensitive task duplication separately from case-insensitive name matching, extend deterministic exploration to relational membership predicates, and validate case-insensitive literals without enumerating every spelling.

- [#191](https://github.com/ash-r1/type-git/pull/191) [`b754fd0`](https://github.com/ash-r1/type-git/commit/b754fd0f100952bf7e66983b8d65838f04a91431) Thanks [@ash-r1](https://github.com/ash-r1)! - Model mandatory Git subcommand selection and validate the selected refs operation through the root command API, including native help and option-boundary ordering.

- [#153](https://github.com/ash-r1/type-git/pull/153) [`a922cf2`](https://github.com/ash-r1/type-git/commit/a922cf218dd45758dc026459c5020cacf83211a6) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed recursive merge aliases, merge-index, difftool, mergetool and request-pull. Preserve native head separators, tool-help early returns, frontend selection differences and ignored tail arguments.

- [#132](https://github.com/ash-r1/type-git/pull/132) [`f963767`](https://github.com/ash-r1/type-git/commit/f963767401826b312210ea46dff97950a37dc83a) Thanks [@ash-r1](https://github.com/ash-r1)! - Extend typed command access to clone, status, commit, fetch, push, branch, checkout, switch, restore, reset, tag, worktree operations, and ten stash operations. Preserve ordered parser behavior, including branch action bits, immediate command-mode conflicts, conflict callback side effects, empty filenames, and explicit path separators. Validate modeled combinations with the shared constraint system and deterministic finite-domain exploration.

- [#168](https://github.com/ash-r1/type-git/pull/168) [`80506f1`](https://github.com/ash-r1/type-git/commit/80506f1dff2fa6b1b910ee8c57c87fc817fbcddd) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate native Git integer options using compiler-recorded signedness, storage widths, optional defaults, and zeroing negations. Accept native numeric strings and bigint without losing 64-bit precision, preserve argv spellings, and validate literal ranges and normalized option combinations in TypeScript.

- [#169](https://github.com/ash-r1/type-git/pull/169) [`4efe6f0`](https://github.com/ash-r1/type-git/commit/4efe6f036c867910f72f570386a9bace13a60c84) Thanks [@ash-r1](https://github.com/ash-r1)! - Model Git numeric callback conversion stages separately from native integer handlers. Accept decimal strings and bigint for supported callbacks, validate C overflow/narrowing and callback-specific checks in runtime and literal types, and share mainline conversion with convenience cherry-pick/revert methods. Preserve large numeric shorthand and explicitly empty optional short arguments.

- [#166](https://github.com/ash-r1/type-git/pull/166) [`338b7f7`](https://github.com/ash-r1/type-git/commit/338b7f702c1a6171509b0be3d7f9632e891474c4) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate shared Git object-filter argument grammars in the typed command API and model clone/fetch auto-filter conflicts, resets, and persistent parser history declaratively. Compare bounded filter sequences and lexical boundary cases with native Git 2.55.

- [#170](https://github.com/ash-r1/type-git/pull/170) [`fa950fb`](https://github.com/ash-r1/type-git/commit/fa950fba76a345c13d2c98ad18a5fddb0a4feb0e) Thanks [@ash-r1](https://github.com/ash-r1)! - Check object-filter numeric limits and percent-decoded combined filters in literal command arguments. Share native unsigned-long bounds with runtime validation, preserve Git's malformed and zero-byte escape behavior, and reject decoded invalid child filters before execution. Dynamic or compiler-budget-exceeding values retain runtime validation. Keep symbolic number/bigint slots in numeric string templates eligible for runtime checks rather than rejecting potentially valid input.

- [#141](https://github.com/ash-r1/type-git/pull/141) [`648f444`](https://github.com/ash-r1/type-git/commit/648f4442844ec293bdd4619f5624fd4c80ca8c01) Thanks [@ash-r1](https://github.com/ash-r1)! - Add 17 typed object and utility command scopes, including cat-file, repack, replace and rerere operations. Apply Git-derived callback, mode, operand and prerequisite rules while preserving native ignored arguments and final-value behavior.

- [#172](https://github.com/ash-r1/type-git/pull/172) [`51d63e5`](https://github.com/ash-r1/type-git/commit/51d63e52e806f88acb04268f4397b1f670e710d5) Thanks [@ash-r1](https://github.com/ash-r1)! - Model ordered help exits for 19 ordinary single-pass command parsers. Validate color callback values for branch, tag, for-each-ref and show-branch against Git's ASCII case-insensitive always/auto/never grammar, while preserving arguments that Git ignores after help. Keep OS string and structured token checks active for ignored arguments.

- [#162](https://github.com/ash-r1/type-git/pull/162) [`f82af08`](https://github.com/ash-r1/type-git/commit/f82af08941792d81649d990bf5b8add05e7095a1) Thanks [@ash-r1](https://github.com/ash-r1)! - Add all registered git-p4 operations with inherited option declarations extracted deterministically from Python AST. Model operand counts, immediate choices, explicit keep-path destinations and accumulated positive shelve changelists.

- [#151](https://github.com/ash-r1/type-git/pull/151) [`f9d4593`](https://github.com/ash-r1/type-git/commit/f9d4593e89be7ded0c6cef92e570fb4a9da67266) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed pack-objects, index-pack, unpack-objects and pack-redundant scopes, including output/input modes, revision-walk prerequisites, callback arities and native obsolete-command acknowledgement. Add Uint8Array command input and explicit byte stdout capture across Node, Bun and Deno so pack data can pass through the public command API without UTF-8 conversion.

- [#192](https://github.com/ash-r1/type-git/pull/192) [`a7a775c`](https://github.com/ash-r1/type-git/commit/a7a775cfb27dbde043591acdf7e22ab9746cd331) Thanks [@ash-r1](https://github.com/ash-r1)! - Model native single-word parse-options completion exits in declarative command metadata and the shared runtime and literal parsers.

- [#137](https://github.com/ash-r1/type-git/pull/137) [`2d9cfd2`](https://github.com/ash-r1/type-git/commit/2d9cfd200f68199d76305c323fc3e06339611516) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed apply and am commands, following immediate callback validation and conditional patch delegation. Preserve native command-mode aliases and value-dependent modes, and deterministically enumerate their transitions. Omit two negated apply callbacks that abort Git 2.55.

- [#175](https://github.com/ash-r1/type-git/pull/175) [`d39f4f4`](https://github.com/ash-r1/type-git/commit/d39f4f4d22b2e0d19ad8db1d1157e4504871f1c0) Thanks [@ash-r1](https://github.com/ash-r1)! - Model initial parse-options help exits for log, show, whatchanged, fast-export, cherry-pick and revert. Derive first-pass recognition from pinned Git tables and interpret serialized argument words, including split values and short clusters, before checking reached callbacks. Share decoration and fast-export reencoding boolean grammars between runtime and compiler checks.

  Observe initial depth conversion independently of C long width for CLI and convenience calls, reject universally invalid literal depths while retaining dynamic inputs and source alternatives, and select submodule update init aliases from the actual helper capability. Preserve native help exit codes and limit readonly observations to relevant parser paths.

- [#142](https://github.com/ash-r1/type-git/pull/142) [`fbb7213`](https://github.com/ash-r1/type-git/commit/fbb7213455e0dc50a41ab52029ffaebb78d21c7b) Thanks [@ash-r1](https://github.com/ash-r1)! - Add 20 typed protocol and text utility scopes, including mailinfo, mailsplit, interpret-trailers, URL parsing, hook operations, credential helpers and internal checkout/archive helpers. Preserve native callback effects, operand grammars, attached short values and ignored helper operations.

- [#179](https://github.com/ash-r1/type-git/pull/179) [`236b62e`](https://github.com/ash-r1/type-git/commit/236b62ee8978675e5d71528fa49b70755a984c2b) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate format-patch through its native option and revision parser phases. Honor help before final subject/cover checks, preserve earlier callback failures, and interpret retained argv with phase-specific option definitions in runtime and literal type checks.

- [#190](https://github.com/ash-r1/type-git/pull/190) [`484ac2e`](https://github.com/ash-r1/type-git/commit/484ac2e5a5843aa94ddb186277db96afa15e84b4) Thanks [@ash-r1](https://github.com/ash-r1)! - Model native refs subcommand and ref/signature option parsing, preserving show-ref's HEAD flag in short clusters and using a separate internal help exit.

- [#186](https://github.com/ash-r1/type-git/pull/186) [`515d449`](https://github.com/ash-r1/type-git/commit/515d4493c141f2039e91364765c3ecd54a04f1df) Thanks [@ash-r1](https://github.com/ash-r1)! - Model native branch, tag, status and commit option passes, including long prefixes, LASTARG_DEFAULT consumption and help timing. Validate column token lists, empty object callback arguments, final untracked-file boolean values and commit cleanup modes using shared declarative rules and literal TypeScript checks.

  Require every finite literal alternative to satisfy final constraints; preserve early exits and runtime deferral for opaque and symbolic strings.

- [#135](https://github.com/ash-r1/type-git/pull/135) [`7a93d8d`](https://github.com/ash-r1/type-git/commit/7a93d8d10963b79b9ce1febae6149c433802f725) Thanks [@ash-r1](https://github.com/ash-r1)! - Add all seven explicit reflog operations and stash show to the typed command API. Model command parser defaults and attached short values used by delegated parsers. Expand shared object-filter and dirstat constraints from pinned Git source.

- [#177](https://github.com/ash-r1/type-git/pull/177) [`67081e4`](https://github.com/ash-r1/type-git/commit/67081e4ea3ccb3f496648bbfdb402ba945b2dbf0) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate the actual argument stream retained by Git's initial parser before applying revision and diff constraints. Preserve consumed values, remaining short clusters, command-specific separators and separate option meanings across parser phases in runtime and literal type checks.

- [#134](https://github.com/ash-r1/type-git/pull/134) [`1eba63b`](https://github.com/ash-r1/type-git/commit/1eba63ba88ce2939d56df05460802e3c6da25c0e) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed log, show, diff, diff-files, diff-index, diff-tree and explicit no-index command scopes. Share reviewed revision/diff rules, validate immediate parser transitions in runtime and literal types, and explore those transitions deterministically. Correct native negative option spelling and filename-negation behavior.

- [#146](https://github.com/ash-r1/type-git/pull/146) [`d0d4130`](https://github.com/ash-r1/type-git/commit/d0d41301602573543262d13e9313ad91f374e8fc) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed pull, shortlog, show-branch, rev-parse dispatch modes, pickaxe and whatchanged scopes. Preserve callback grammars, native aliases, separate-value options, deprecated-command opt-in and mode transitions.

- [#149](https://github.com/ash-r1/type-git/pull/149) [`1d89be4`](https://github.com/ash-r1/type-git/commit/1d89be49268da572918838d0b6aed827720c8ef2) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed root dispatch for bundle, commit-graph, history, hook, maintenance, multi-pack-index, refs and repo, preserving parent option placement and required registered operations.

- [#145](https://github.com/ash-r1/type-git/pull/145) [`11481c9`](https://github.com/ash-r1/type-git/commit/11481c94e3642c5c705a66b7dab9ec2a085d74b9) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed blame, annotate, grep, format-patch and archive scopes. Support native numeric shorthand such as grep -12, preserve command-specific short options and callback ordering, and model early-return behavior without imposing extra Git restrictions.

- [#160](https://github.com/ash-r1/type-git/pull/160) [`f56a87b`](https://github.com/ash-r1/type-git/commit/f56a87b6a1e932404ab742b84681e8cce258a235) Thanks [@ash-r1](https://github.com/ash-r1)! - Model send-email's staged option parsing, alias inspection restrictions, final suppression lists and native confirmation-prefix semantics without imposing configuration-dependent requirements unconditionally.

- [#136](https://github.com/ash-r1/type-git/pull/136) [`fbe9771`](https://github.com/ash-r1/type-git/commit/fbe9771ee25f23355bb79b41c292314969e280b4) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed merge, rebase, cherry-pick, revert, merge-base and commit-tree command scopes. Model continuation argument counts, backend transitions and ASCII enum matching; disambiguate repeated upstream option tables and preserve command-specific option precedence.

- [#158](https://github.com/ash-r1/type-git/pull/158) [`2dfee19`](https://github.com/ash-r1/type-git/commit/2dfee19a0fe651bf788540ccaa331bd8600364cf) Thanks [@ash-r1](https://github.com/ash-r1)! - Model filter-branch, quiltimport, instaweb actions and git-shell argument grammars. Add declarative array-element membership constraints and distinguish sourced Git shell libraries from executable subcommands in coverage reporting.

- [#184](https://github.com/ash-r1/type-git/pull/184) [`e9f2e68`](https://github.com/ash-r1/type-git/commit/e9f2e68a9dec4375f07d5d339be11c1250d64db0) Thanks [@ash-r1](https://github.com/ash-r1)! - Model stash show's initial option pass and retained-argument partition in shared runtime and literal type validation. Keep stash references separate from revision/path arguments, preserve native help timing, and parse deferred diff options only in the stream that Git actually receives.

- [#183](https://github.com/ash-r1/type-git/pull/183) [`3fb98f2`](https://github.com/ash-r1/type-git/commit/3fb98f2487154ba156a4fe84b3dfacac3989908d) Thanks [@ash-r1](https://github.com/ash-r1)! - Model native stash import/export option passes in runtime and literal type validation. Preserve their literal `--` revision operands, native abbreviation and negation rules, and help exits before final arity or destination checks.

- [#176](https://github.com/ash-r1/type-git/pull/176) [`8ddce29`](https://github.com/ash-r1/type-git/commit/8ddce29c139257d8da26e801d75711e892eb1bfb) Thanks [@ash-r1](https://github.com/ash-r1)! - Share source-backed string grammars between runtime validation and TypeScript literal checking for fast-export anonymization maps and fast-import signature modes. Preserve first-colon splitting, identity mappings, case-sensitive mode names and arbitrary sign-if-invalid key suffixes, including an empty suffix.

- [#147](https://github.com/ash-r1/type-git/pull/147) [`c571c3d`](https://github.com/ash-r1/type-git/commit/c571c3dfe6f1e26aeb6237d0297624c9601bb025) Thanks [@ash-r1](https://github.com/ash-r1)! - Add 39 typed submodule, internal submodule helper and sparse-checkout scopes. Distinguish shell frontend spellings from helper options, preserve native dispatch, early returns and ignored operands, and model init/filter prerequisites and tracking choices.

- [#163](https://github.com/ash-r1/type-git/pull/163) [`4cca689`](https://github.com/ash-r1/type-git/commit/4cca6898c4fc96ad673aec2f147768fc9289afe2) Thanks [@ash-r1](https://github.com/ash-r1)! - Add git-svn and all 25 registered operations from reproducible option table extraction. Model operand requirements, alias overrides and explicit conflicts while permitting settings supplied through Git configuration. Record missing native SVN dependencies and remaining delegated grammars explicitly.

- [#178](https://github.com/ash-r1/type-git/pull/178) [`1fddb2b`](https://github.com/ash-r1/type-git/commit/1fddb2bf4d72f0cd1849d9191b6ac7adb3b8fb1b) Thanks [@ash-r1](https://github.com/ash-r1)! - Model the ordered native wrapper, log and revision parsers for reflog and reflog show. Match Git's help timing, retained arguments, decoration/color validation and implicit reflog traversal in both runtime and literal type checks.

- [#152](https://github.com/ash-r1/type-git/pull/152) [`83c2bbc`](https://github.com/ash-r1/type-git/commit/83c2bbcedd9b40e70ebf0e9d48223cf1cb59277b) Thanks [@ash-r1](https://github.com/ash-r1)! - Add typed fetch-pack, send-pack, upload-pack, receive-pack, remote-ext and remote-fd commands, including native destination arities, send mode constraints and literal helper arguments.

- [#185](https://github.com/ash-r1/type-git/pull/185) [`aac7f56`](https://github.com/ash-r1/type-git/commit/aac7f56a7941860d682f44ea9d57cdd566d45a86) Thanks [@ash-r1](https://github.com/ash-r1)! - Model native add, rm, mv and clean option passes in runtime and literal type validation. Resolve native long abbreviations and short clusters, reject unknown or malformed options before help, and preserve remaining paths literally after consumed end markers.

### Patch Changes

- [#272](https://github.com/ash-r1/type-git/pull/272) [`a838c13`](https://github.com/ash-r1/type-git/commit/a838c13ce6810d0775c6371e37f65de9c75da3aa) Thanks [@ash-r1](https://github.com/ash-r1)! - Allow the canonical sole diff-files --help-all flag to reach native Git usage output.

- [#274](https://github.com/ash-r1/type-git/pull/274) [`f689d96`](https://github.com/ash-r1/type-git/commit/f689d9630120cfef436c63463ce577bdf96a8706) Thanks [@ash-r1](https://github.com/ash-r1)! - Allow the canonical sole diff-tree --help-all flag to reach native Git usage output.

- [#264](https://github.com/ash-r1/type-git/pull/264) [`75aeaf8`](https://github.com/ash-r1/type-git/commit/75aeaf85aef4db18fb58632df72e2f226e4d791e) Thanks [@ash-r1](https://github.com/ash-r1)! - Allow a sole check-ref-format --help-all tuple to reach selected native usage before refname arity validation.

- [#248](https://github.com/ash-r1/type-git/pull/248) [`afcac44`](https://github.com/ash-r1/type-git/commit/afcac44800b96a5876cb050ff24fa74269ab240a) Thanks [@ash-r1](https://github.com/ash-r1)! - Model ordered cherry internal help and sole completion exits while preserving earlier abbreviation callback failures and end-of-options boundaries.

- [#239](https://github.com/ash-r1/type-git/pull/239) [`baf3b8a`](https://github.com/ash-r1/type-git/commit/baf3b8a2550d1a55f8108829bdc959e4444d5e28) Thanks [@ash-r1](https://github.com/ash-r1)! - Honor ordered internal help and sole completion in merge-base, patch-id and stripspace while retaining reached mode conflicts and argument representation checks.

- [#296](https://github.com/ash-r1/type-git/pull/296) [`203f718`](https://github.com/ash-r1/type-git/commit/203f718fea91c34100249686e97ead0455da2c4c) Thanks [@ash-r1](https://github.com/ash-r1)! - Match the selected Git's handling of empty `+`-separated components in `combine:` object filters. Git 2.54 and later skip them, while older Git rejects them with `invalid filter-spec`; when a filter contains an empty component, a read-only clone help probe now selects the executable's behavior for both typed commands and convenience clone/fetch/submodule validation.

- [#269](https://github.com/ash-r1/type-git/pull/269) [`db467a8`](https://github.com/ash-r1/type-git/commit/db467a86305d7e508e644618620e1a1492a7b5fa) Thanks [@ash-r1](https://github.com/ash-r1)! - Reuse the per-command argument vocabulary during type checking to reduce repeated type instantiations, preserving literal command unions and empty command sets.

- [#164](https://github.com/ash-r1/type-git/pull/164) [`6678486`](https://github.com/ash-r1/type-git/commit/66784860991381869baf4ceba92b1b3dba684dbf) Thanks [@ash-r1](https://github.com/ash-r1)! - Require all pinned executable inventory entries to have audited typed CLI scopes, and publish separate API/constraint coverage metrics. Add isolated byte-for-byte upstream extraction verification with source fingerprint and compiler-profile checks.

- [#297](https://github.com/ash-r1/type-git/pull/297) [`9c23d71`](https://github.com/ash-r1/type-git/commit/9c23d719c6f998d7a789f14abe82b50babd0e9ea) Thanks [@ash-r1](https://github.com/ash-r1)! - `command()` now accepts optional general-mode options such as `GitCommandExecOpts<GitOutputMode> | undefined` or an optional `GitCommandExecOpts<'bytes'>`, resolving to `RawResult<string | Uint8Array>` instead of failing overload resolution. Literal `{ stdout: 'bytes' }` still yields `RawResult<Uint8Array>` and omitted or text-mode options still yield `RawResult<string>`.

- [#286](https://github.com/ash-r1/type-git/pull/286) [`d7dd724`](https://github.com/ash-r1/type-git/commit/d7dd72498d482d41758a9d4fe6a4ad9f34e3e9f3) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate commit-graph filter counts with the native decimal callback grammar, including literal types, negation and help ordering.

- [#249](https://github.com/ash-r1/type-git/pull/249) [`f69a476`](https://github.com/ash-r1/type-git/commit/f69a4766ef013f30e3df947135f15896b1ad7b2d) Thanks [@ash-r1](https://github.com/ash-r1)! - Model ordered commit-tree internal help and sole completion exits while preserving reached parent and message-file callbacks.

- [#260](https://github.com/ash-r1/type-git/pull/260) [`773630d`](https://github.com/ash-r1/type-git/commit/773630d1cb4489f2b047de002cb8e57a4bced84d) Thanks [@ash-r1](https://github.com/ash-r1)! - Accept credential sole usage words while retaining exact operation arity and first-word documentation dispatch.

- [#293](https://github.com/ash-r1/type-git/pull/293) [`9e5689c`](https://github.com/ash-r1/type-git/commit/9e5689c8d87a7a13ad187183a6739717d77d8b20) Thanks [@ash-r1](https://github.com/ash-r1)! - Ship the shared type declaration chunk once instead of as identical ESM and CJS copies (about 5 MB smaller unpacked), and add `require` type conditions to `exports` so CommonJS consumers using `moduleResolution: node16`/`nodenext` resolve the `.d.cts` declarations instead of failing with TS1479.

- [#226](https://github.com/ash-r1/type-git/pull/226) [`e9510b2`](https://github.com/ash-r1/type-git/commit/e9510b2930a8f7159ad85b5ad06b7115355c4ce8) Thanks [@ash-r1](https://github.com/ash-r1)! - Reject nonpositive absolute numeric line locations and zero relative lengths in blame, annotate, and pickaxe ranges after option parsing. Preserve native help preemption, repeated ranges, and native-owned regex, function-name, and repository-dependent behavior.

- [#299](https://github.com/ash-r1/type-git/pull/299) [`d044397`](https://github.com/ash-r1/type-git/commit/d04439730e8e485ce27626866966740a0895a71f) Thanks [@ash-r1](https://github.com/ash-r1)! - Remove the private temporary directory created by `createTempFile` when the built-in Node.js, Bun, and Deno adapters delete that temp file, so the depth atoi probe no longer leaves an empty `type-git-depth-profile-*` directory behind in the system temp directory on every observation.

- [#289](https://github.com/ash-r1/type-git/pull/289) [`3335c2b`](https://github.com/ash-r1/type-git/commit/3335c2b827658a340cf714f45f6ad9a740f3c712) Thanks [@ash-r1](https://github.com/ash-r1)! - Preserve ordered diagnostic help and completion exits for bugreport and diagnose, including ignored later callback values and unknown words.

- [#291](https://github.com/ash-r1/type-git/pull/291) [`2da5211`](https://github.com/ash-r1/type-git/commit/2da52113cfcb11f921564b4aada8ed2100f26589) Thanks [@ash-r1](https://github.com/ash-r1)! - Stop shipping sourcemaps in the npm package, reducing the unpacked size by about 36MB.

- [#279](https://github.com/ash-r1/type-git/pull/279) [`b32ea95`](https://github.com/ash-r1/type-git/commit/b32ea95b4afc1e738de4cfecd949f3da1898268c) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate reached diff output indicator literals as one UTF-8 byte across the shared diff parser scopes.

  Reduce temporary type construction while collecting keys read by command constraints.

- [#265](https://github.com/ash-r1/type-git/pull/265) [`9781df2`](https://github.com/ash-r1/type-git/commit/9781df275a6a1d0d7bd09f4e846fd9d90730516c) Thanks [@ash-r1](https://github.com/ash-r1)! - Allow a sole fetch-pack --help-all tuple to reach selected native usage before destination arity validation.

- [#250](https://github.com/ash-r1/type-git/pull/250) [`0919761`](https://github.com/ash-r1/type-git/commit/0919761f34781ab18180d46557a5d4be99c42214) Thanks [@ash-r1](https://github.com/ash-r1)! - Model ordered for-each-repo internal help and sole completion exits while preserving required config values and the first-operand parsing boundary.

- [#237](https://github.com/ash-r1/type-git/pull/237) [`866a96d`](https://github.com/ash-r1/type-git/commit/866a96dbafaabbd2b25eb0a3ece091403db81452) Thanks [@ash-r1](https://github.com/ash-r1)! - Honor ordered internal help and sole completion in hash-object, rerere, merge-file and check-attr while retaining reached callbacks and argument shape checks.

- [#256](https://github.com/ash-r1/type-git/pull/256) [`4dfeff8`](https://github.com/ash-r1/type-git/commit/4dfeff845cf37b2a215d8570b0d66a741bc56343) Thanks [@ash-r1](https://github.com/ash-r1)! - Accept get-tar-commit-id sole usage spellings while preserving zero-argument tar input handling.

- [#300](https://github.com/ash-r1/type-git/pull/300) [`26bb4c5`](https://github.com/ash-r1/type-git/commit/26bb4c5af2963382a4b1e296136e7e259326bfcb) Thanks [@ash-r1](https://github.com/ash-r1)! - Repository-requiring native probes (such as the `pack-objects --max-pack-size=-0 -h` sign probe used to validate `clone` filters like `blob:limit=-1`) no longer depend on `process.cwd()` when run for repository-less (global) contexts. They now run against a throwaway empty bare repository created in a fresh temp directory, which is removed afterwards, so validation is no longer silently skipped outside a repository and no longer reads an unrelated repository's configuration. `FsAdapter` gains an optional `createTempDirectory()` method, implemented by the Node, Bun and Deno adapters.

- [#230](https://github.com/ash-r1/type-git/pull/230) [`741e188`](https://github.com/ash-r1/type-git/commit/741e188831e4d9b7d36c20dc0b10c334fec88a98) Thanks [@ash-r1](https://github.com/ash-r1)! - Recognize grep's single-word completion helpers while rejecting reached multiword uses before later help. Preserve earlier help, pattern values, operands and the native unsupported-helper result on older Git.

- [#229](https://github.com/ash-r1/type-git/pull/229) [`a398d0c`](https://github.com/ash-r1/type-git/commit/a398d0c305ae6fccf70605aff6de97565e1e8b20) Thanks [@ash-r1](https://github.com/ash-r1)! - Recognize grep's internal `--help-all` and preserve its extended-help exit before later callbacks, including in first position. Keep earlier integer failures and help-looking pattern or operand values delegated to their native interpretation.

- [#227](https://github.com/ash-r1/type-git/pull/227) [`83e9f03`](https://github.com/ash-r1/type-git/commit/83e9f03b6a54217a03ee3c4876091c1de5f487a5) Thanks [@ash-r1](https://github.com/ash-r1)! - Preserve grep's internal long-help exit before later value callbacks while keeping earlier errors and stop-at-operand parsing. Short `-h` continues to suppress filenames and does not select help.

- [#228](https://github.com/ash-r1/type-git/pull/228) [`b9ed141`](https://github.com/ash-r1/type-git/commit/b9ed1417fabd94ad4e48a9b5c3275d730e179a69) Thanks [@ash-r1](https://github.com/ash-r1)! - Allow a lone `grep -h` to reach Git's native short-help shortcut before filename-option parsing and pattern validation. Additional arguments continue to use ordinary `-h` filename suppression.

- [#267](https://github.com/ash-r1/type-git/pull/267) [`80d63f5`](https://github.com/ash-r1/type-git/commit/80d63f55fa1ca7c0fae8fe96f14b12f469e98d46) Thanks [@ash-r1](https://github.com/ash-r1)! - Allow a sole index-pack --help-all tuple to reach selected native usage before pack-input arity validation.

- [#292](https://github.com/ash-r1/type-git/pull/292) [`7e44259`](https://github.com/ash-r1/type-git/commit/7e44259b7daf36a5343f451ea37cbb2c40be8d92) Thanks [@ash-r1](https://github.com/ash-r1)! - Ship the runtime command catalogue as compact JSON with shared subtrees, decoded on the first typed command call instead of evaluated as an object literal at import time. Each bundle shrinks by about 0.95 MB and importing the package no longer pays for the catalogue unless typed commands are used. Command types are unchanged.

- [#301](https://github.com/ash-r1/type-git/pull/301) [`87884f3`](https://github.com/ash-r1/type-git/commit/87884f35d099a3598061af9e0fa270b68687d342) Thanks [@ash-r1](https://github.com/ash-r1)! - Accept a bare unit suffix (`k`, `m`, `g`, case-insensitive) as zero for unsigned magnitude values under the older strtoumax profile selected for Git 2.25, matching `git_parse_unsigned`, which lacks the `end == value` check there. Object filters such as `--filter=blob:limit=k` or `tree:G` and unsigned-long magnitude options such as `pack-objects --max-pack-size=g` are no longer rejected before execution on that profile, both at runtime and in the type-level grammar; such values also now trigger the selected executable's sign-policy probe.

- [#298](https://github.com/ash-r1/type-git/pull/298) [`8955b7d`](https://github.com/ash-r1/type-git/commit/8955b7d9e72c89b4a2a9f2a10f9fa1e634ffaa04) Thanks [@ash-r1](https://github.com/ash-r1)! - Refuse operand objects that Git would read as options in commands with a native first parser pass. `fetch`, `clone`, `push`, `reset`, `add`, `commit`, `log`, `stash list` and similar commands previously forwarded `{ operand: '--upload-pack=...' }`, `{ operand: '--hard' }` or `{ operand: '--' }` as live options or boundaries; `cherry-pick` and `revert` did so even after `['--']`, which their first parser drops before revision parsing. Such operands now raise the same `["--"]` separator error as other commands, while operands after an honored separator and words before a native help or completion exit are unchanged. The same refusal applies when the runner forwards the original argv after an inconclusive native profile observation, so those fallbacks no longer pass such an operand to Git as an option.

- [#244](https://github.com/ash-r1/type-git/pull/244) [`67c58c2`](https://github.com/ash-r1/type-git/commit/67c58c280cadcbe57b7a667c4f09176be4162ddd) Thanks [@ash-r1](https://github.com/ash-r1)! - Model ordered ls-files internal help and sole completion words, preserving callbacks reached before help and validating argument shape after it.

- [#247](https://github.com/ash-r1/type-git/pull/247) [`42bc8be`](https://github.com/ash-r1/type-git/commit/42bc8beff22555416f843fdaae2ecb5e910dc845) Thanks [@ash-r1](https://github.com/ash-r1)! - Model ordered ls-remote full help and sole completion words, preserving multiword -h as heads and the first-operand parsing boundary.

- [#245](https://github.com/ash-r1/type-git/pull/245) [`100e689`](https://github.com/ash-r1/type-git/commit/100e6891f468572535562aa965627a232b1a3dfe) Thanks [@ash-r1](https://github.com/ash-r1)! - Model ordered ls-tree internal help and completion. Observe the selected Git's legacy bit or modern command-mode callbacks before help, preserving reached numeric checks and argument representation guards.

- [#246](https://github.com/ash-r1/type-git/pull/246) [`4c6a1ba`](https://github.com/ash-r1/type-git/commit/4c6a1ba84a9a8b43efdbf3ba0818c6af447f0a7e) Thanks [@ash-r1](https://github.com/ash-r1)! - Extend the selected ls-tree bit/command-mode profile to calls without help, allowing legacy mode combinations while retaining final tree requirements, reached callbacks and modern mode conflicts.

- [#251](https://github.com/ash-r1/type-git/pull/251) [`df818ad`](https://github.com/ash-r1/type-git/commit/df818adf42dadb39ee64b5ad45cc1d63d4c22f07) Thanks [@ash-r1](https://github.com/ash-r1)! - Model ordered mailinfo internal help and sole completion exits while preserving reached quoted-CR validation and required encoding values.

- [#266](https://github.com/ash-r1/type-git/pull/266) [`c333451`](https://github.com/ash-r1/type-git/commit/c3334512d5233a0741a5d480fbc2ca0260bb838b) Thanks [@ash-r1](https://github.com/ash-r1)! - Allow a sole mailsplit --help-all tuple to reach selected native usage before output-directory arity validation.

- [#234](https://github.com/ash-r1/type-git/pull/234) [`ee5c93f`](https://github.com/ash-r1/type-git/commit/ee5c93ff4c3b180f3a8b17edc1b4ee8ec8082a6d) Thanks [@ash-r1](https://github.com/ash-r1)! - Match native ordered internal help and sole-word completion in four maintenance command parsers.

- [#254](https://github.com/ash-r1/type-git/pull/254) [`3e435cf`](https://github.com/ash-r1/type-git/commit/3e435cf65ec2134a7c90a8b5d815141eb5911095) Thanks [@ash-r1](https://github.com/ash-r1)! - Accept canonical and tagged sole merge-index usage words while preserving ordinary entrypoint arity.

- [#255](https://github.com/ash-r1/type-git/pull/255) [`fc793dc`](https://github.com/ash-r1/type-git/commit/fc793dc20a9fdd2793a8887394ff22a16e973389) Thanks [@ash-r1](https://github.com/ash-r1)! - Accept merge-one-file first-word help in canonical and tagged forms while preserving normal operand arity.

- [#252](https://github.com/ash-r1/type-git/pull/252) [`f547720`](https://github.com/ash-r1/type-git/commit/f5477208a26892314bf2ec749ce92787d8b81149) Thanks [@ash-r1](https://github.com/ash-r1)! - Accept the merge-ours --help-all flag while preserving the selected Git executable's help or index-comparison behavior.

- [#240](https://github.com/ash-r1/type-git/pull/240) [`df45e1b`](https://github.com/ash-r1/type-git/commit/df45e1bf1ac4c5cbb1def5e669f96c2afa70efa1) Thanks [@ash-r1](https://github.com/ash-r1)! - Honor ordered internal help and sole completion in describe and name-rev while preserving reached callbacks and argument representation checks.

- [#200](https://github.com/ash-r1/type-git/pull/200) [`f8904f9`](https://github.com/ash-r1/type-git/commit/f8904f9783a94521ba18cb492258198c51ba55f9) Thanks [@ash-r1](https://github.com/ash-r1)! - Preserve selected Git filename parser profiles, optional path state, and native parser error ordering in runtime and literal constraints.

- [#302](https://github.com/ash-r1/type-git/pull/302) [`1a8b9c4`](https://github.com/ash-r1/type-git/commit/1a8b9c4ac8e3bcb55213dad9444649a352c9347d) Thanks [@ash-r1](https://github.com/ash-r1)! - Reject negative unsigned magnitudes with more than one unit suffix (such as `-0kk` or `blob:limit=-0Kg`) at the type level, matching the runtime parser and Git, which accept at most one `k`/`m`/`g` suffix.

- [#238](https://github.com/ash-r1/type-git/pull/238) [`7332203`](https://github.com/ash-r1/type-git/commit/73322032d681627617fc741c4272833014392a6a) Thanks [@ash-r1](https://github.com/ash-r1)! - Honor ordered internal help and sole completion in pack-objects and gc while preserving reached callbacks and argument representation checks.

- [#287](https://github.com/ash-r1/type-git/pull/287) [`756f0e0`](https://github.com/ash-r1/type-git/commit/756f0e0ce02e702a8788045bd272dc737a741053) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate pack-objects and index-pack index-version values with their native conversion and comma rules.

- [#263](https://github.com/ash-r1/type-git/pull/263) [`dddbfe2`](https://github.com/ash-r1/type-git/commit/dddbfe291283811edb5e85a6a16901edf8310e80) Thanks [@ash-r1](https://github.com/ash-r1)! - Allow a sole pack-redundant --help-all tuple to reach selected native usage handling before opt-in and pack arity checks.

- [#262](https://github.com/ash-r1/type-git/pull/262) [`a5731ea`](https://github.com/ash-r1/type-git/commit/a5731eaff0d84a9e9dbb6056d2703b9ed44812ec) Thanks [@ash-r1](https://github.com/ash-r1)! - Delegate pack-redundant deprecation acknowledgement to the selected Git so older successful calls are not rejected by modern-only constraints.

- [#278](https://github.com/ash-r1/type-git/pull/278) [`cc89e10`](https://github.com/ash-r1/type-git/commit/cc89e1080d20a1cd5190cf454ef96ec6e77aaee1) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate reached diff stat scalar and comma-field callbacks while preserving native command-specific help ordering.

- [#241](https://github.com/ash-r1/type-git/pull/241) [`62b7c9c`](https://github.com/ash-r1/type-git/commit/62b7c9c6cb9eaf48a347a4e6141c052c9d41c105) Thanks [@ash-r1](https://github.com/ash-r1)! - Honor ordered internal help and sole completion in interpret-trailers and mktag while retaining reached callbacks and argument representation checks.

- [#233](https://github.com/ash-r1/type-git/pull/233) [`e878087`](https://github.com/ash-r1/type-git/commit/e878087245bf0b75b2eda3fdca16f0e748281957) Thanks [@ash-r1](https://github.com/ash-r1)! - Match ordered native internal-help and sole-word completion exits in six ordinary plumbing parsers.

- [#303](https://github.com/ash-r1/type-git/pull/303) [`35c7a97`](https://github.com/ash-r1/type-git/commit/35c7a97c537ae2c23072f539c0d26e38116804ae) Thanks [@ash-r1](https://github.com/ash-r1)! - Run internal capability probes without tracing. When `audit.onTrace` was set (or `GIT_TRACE*` variables were configured), trace lines were mixed into probe stderr, so exact diagnostic matches failed and native-constraint validation (for example rejecting `depth: 2147483648` on 64-bit Git) was silently skipped. Probes now strip `GIT_TRACE`, `GIT_TRACE2*`, `GIT_TRACE_*` and `GIT_CURL_VERBOSE` from their environment and no longer emit events to `onAudit` / `onTrace`; the user's own command is still traced and audited as before.

- [#235](https://github.com/ash-r1/type-git/pull/235) [`20d2f95`](https://github.com/ash-r1/type-git/commit/20d2f95642ed9e9eac905afa2d5e172817ec249c) Thanks [@ash-r1](https://github.com/ash-r1)! - Preserve native prune internal-help and completion exits while retaining earlier expiry-date failures.

- [#276](https://github.com/ash-r1/type-git/pull/276) [`9c2f0e8`](https://github.com/ash-r1/type-git/commit/9c2f0e86face5862b83e89b48c34b59ffed9634d) Thanks [@ash-r1](https://github.com/ash-r1)! - Reject reached ambiguous --color spellings in blame, annotate and pickaxe while preserving ignored words after native help.

- [#288](https://github.com/ash-r1/type-git/pull/288) [`ee5a055`](https://github.com/ash-r1/type-git/commit/ee5a055a42e630e312eb4e1f8102bd64308dc86d) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate range-diff maximum memory values using native unsigned size_t bounds and ordered help handling.

- [#243](https://github.com/ash-r1/type-git/pull/243) [`aca0efe`](https://github.com/ash-r1/type-git/commit/aca0efecf75e8f33f624fda4834a6c6f1acd7093) Thanks [@ash-r1](https://github.com/ash-r1)! - Observe the selected Git's read-tree exclude callback family for calls without help. Accept legacy filenames and later -u while preserving the legacy final update prerequisite and duplicate rejection.

- [#242](https://github.com/ash-r1/type-git/pull/242) [`8472044`](https://github.com/ash-r1/type-git/commit/8472044214d039779020546fd1b4dd1c10e86694) Thanks [@ash-r1](https://github.com/ash-r1)! - Observe the selected Git exclude callback family before read-tree help, preserving legacy value and repetition rules without guessing a version threshold.

- [#231](https://github.com/ash-r1/type-git/pull/231) [`dddc75d`](https://github.com/ash-r1/type-git/commit/dddc75d92092eab8f85f82895f0a79d05de50291) Thanks [@ash-r1](https://github.com/ash-r1)! - Recognize full internal `--help-all` in branch, for-each-ref, tag, and show-branch while retaining their native first passes, earlier callback errors and separate documentation dispatch for first-word `--help`.

- [#310](https://github.com/ash-r1/type-git/pull/310) [`c2659b2`](https://github.com/ash-r1/type-git/commit/c2659b234da83577b4e597ed221802e6a5e48957) Thanks [@ash-r1](https://github.com/ash-r1)! - Reject remotes, URLs, refs, names, and paths that start with `-` in the convenience APIs before spawning Git. Such values were parsed as options, so `fetch({ remote: '--upload-pack=<cmd>' })`, `clone`, `pull`, `push`, and `lsRemote` could run arbitrary commands and `log`, `diff`, and `show` could write files through `--output`. These calls now throw `GitArgumentError`; pass a path that starts with `-` as `./-name`. `config.set`, `config.add`, and `config.setRaw` now place `--` before the key so values such as `-1` are stored literally.

- [#261](https://github.com/ash-r1/type-git/pull/261) [`13172a4`](https://github.com/ash-r1/type-git/commit/13172a42a60a130a7b75d368d3811e74327c0c63) Thanks [@ash-r1](https://github.com/ash-r1)! - Accept remote-fd and remote-ext sole usage words while preserving two-word remote/url calls and native helper responses.

- [#236](https://github.com/ash-r1/type-git/pull/236) [`43861bb`](https://github.com/ash-r1/type-git/commit/43861bb2b81972e35b7c5753a826c92b97c00484) Thanks [@ash-r1](https://github.com/ash-r1)! - Preserve repack help exits and select max-pack-size callback timing from the actual Git executable.

- [#271](https://github.com/ash-r1/type-git/pull/271) [`80aeb10`](https://github.com/ash-r1/type-git/commit/80aeb106f8855e4d28a5feaa1b102d0c0e569628) Thanks [@ash-r1](https://github.com/ash-r1)! - Allow a canonical sole rev-list --help-all tuple to reach the selected Git version's usage handling without broadening ordinary argument value types.

- [#270](https://github.com/ash-r1/type-git/pull/270) [`1e13efb`](https://github.com/ash-r1/type-git/commit/1e13efbf41bf3fc10491c056b1143ae8fd56466b) Thanks [@ash-r1](https://github.com/ash-r1)! - Allow the canonical rev-parse --help-all flag while preserving the selected Git version's sole usage shortcut and ordinary multiword flag behavior.

- [#304](https://github.com/ash-r1/type-git/pull/304) [`d6b55dc`](https://github.com/ash-r1/type-git/commit/d6b55dc30c95de1b0b672752b329937dabd201a5) Thanks [@ash-r1](https://github.com/ash-r1)! - Reject deferred unknown revision/diff options before `--end-of-options` at the type level. Argument lists such as `[{ operand: '--bogus' }, { operand: '--end-of-options' }, { operand: 'HEAD' }]` for `log` used to type-check even though the runtime builder (like Git) rejects them with "Unrecognized revision option". The type-level revision parser now runs the same final usage check when it reaches `--end-of-options`.

- [#305](https://github.com/ash-r1/type-git/pull/305) [`f0d622b`](https://github.com/ash-r1/type-git/commit/f0d622b91e3cad4807a773ce0e4b711b657329fc) Thanks [@ash-r1](https://github.com/ash-r1)! - Reject single-dash long-option typos such as `-follow` in retained revision arguments at the type level even when the first short character is not a known short option. The runtime parser and native Git already fail with "requires two dashes" before a later completion exit like `--git-completion-helper`, but the type previously deferred the word as unknown and accepted the call.

- [#295](https://github.com/ash-r1/type-git/pull/295) [`3204222`](https://github.com/ash-r1/type-git/commit/3204222ab07a437595206b00b0e3ce342bba352e) Thanks [@ash-r1](https://github.com/ash-r1)! - Enable code splitting in the bundle so the generated command tables are emitted once per module format in a shared chunk instead of being inlined into every entry point (`type-git`, `type-git/node`, `type-git/bun`, `type-git/deno`). This shrinks the published `dist` from about 69MB to about 25MB without changing the public exports.

- [#285](https://github.com/ash-r1/type-git/pull/285) [`c46fad7`](https://github.com/ash-r1/type-git/commit/c46fad731b839f918d2bd8ac8d85b5fd942d6de8) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate shared parse-options color names in grep, including literal types, while preserving bare defaults, negation and help ordering.

  Share identical readonly predicate metadata to reduce duplicate compiler work during validation.

- [#281](https://github.com/ash-r1/type-git/pull/281) [`94942e2`](https://github.com/ash-r1/type-git/commit/94942e232ba0f3681a9cbebfc1044af6434bf844) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate shared diff-filter callback character sets in runtime and literal constraints while preserving native help ordering and raw argv.

- [#284](https://github.com/ash-r1/type-git/pull/284) [`ec7189b`](https://github.com/ash-r1/type-git/commit/ec7189b14a6b96e06b245231296306f91ff737ac) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate shared dirstat parameter strings while preserving native empty and bare arguments, decimal cutoffs, and help timing.

- [#282](https://github.com/ash-r1/type-git/pull/282) [`5413ff4`](https://github.com/ash-r1/type-git/commit/5413ff4ae2118211ead42c70db6171afcde10e8b) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate shared moved-color mode and whitespace callbacks with native boolean source profiles and ordered whitespace resets.

- [#280](https://github.com/ash-r1/type-git/pull/280) [`c3df283`](https://github.com/ash-r1/type-git/commit/c3df28303c473307cc72c7bfd087c021822cb384) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate reached shared diff rename/copy score strings and break-rewrite score pairs while preserving local short-option meanings and native help ordering.

- [#283](https://github.com/ash-r1/type-git/pull/283) [`bee96d9`](https://github.com/ash-r1/type-git/commit/bee96d9ff6bada7d26bfc5db55e3f88720753656) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate the shared whitespace-error highlighting callback while preserving empty values, one trailing comma, and native help timing.

- [#277](https://github.com/ash-r1/type-git/pull/277) [`d342a17`](https://github.com/ash-r1/type-git/commit/d342a17c67e6423446a111fd1bded90e4fd554a8) Thanks [@ash-r1](https://github.com/ash-r1)! - Validate reached diff color modes while preserving command-specific native help exits.

- [#275](https://github.com/ash-r1/type-git/pull/275) [`fc74391`](https://github.com/ash-r1/type-git/commit/fc7439109cd108439775fcedc2bfa4973679686d) Thanks [@ash-r1](https://github.com/ash-r1)! - Preserve native usage exits and ignored tails for diff --no-index while retaining ordinary argument constraints.

- [#225](https://github.com/ash-r1/type-git/pull/225) [`1d16412`](https://github.com/ash-r1/type-git/commit/1d16412d8a89fe5f8e4a37330ea3b5365b8d45be) Thanks [@ash-r1](https://github.com/ash-r1)! - Match native Git's streaming option order for blame, annotate, and pickaxe: reject reached invalid date modes before later help or replacement values, and let earlier help preempt later callback checks. Preserve revision operands and literal paths after `--`.

- [#306](https://github.com/ash-r1/type-git/pull/306) [`eee31ae`](https://github.com/ash-r1/type-git/commit/eee31ae27b38d837de688d00ad28310939f7954b) Thanks [@ash-r1](https://github.com/ash-r1)! - Treat a bare `-` as an operand in the `git svn` argument types, matching the runtime parser. Previously calls such as `git.command('svn', [['-i', 'x'], { operand: 'log' }, { operand: '-' }])` were rejected at compile time even though they run correctly.

- [#273](https://github.com/ash-r1/type-git/pull/273) [`a6926de`](https://github.com/ash-r1/type-git/commit/a6926decdcad00cfc4b88797e70a6a9a0a7c8a74) Thanks [@ash-r1](https://github.com/ash-r1)! - Allow the canonical sole diff-index --help-all flag to reach native Git usage output.

- [#253](https://github.com/ash-r1/type-git/pull/253) [`583253a`](https://github.com/ash-r1/type-git/commit/583253ae696afd4fce5ec0754c92fb5b169ebe63) Thanks [@ash-r1](https://github.com/ash-r1)! - Accept unpack-file sole help words while retaining native argument-count and blob validation behavior.

- [#268](https://github.com/ash-r1/type-git/pull/268) [`4bc67fa`](https://github.com/ash-r1/type-git/commit/4bc67fa7cf97dbaa73bab55843ff19bad4d31553) Thanks [@ash-r1](https://github.com/ash-r1)! - Allow a sole unpack-objects --help-all tuple to reach selected native usage handling.

- [#259](https://github.com/ash-r1/type-git/pull/259) [`64f04fc`](https://github.com/ash-r1/type-git/commit/64f04fcd614cc270db11de9aefa62422eb2e1651) Thanks [@ash-r1](https://github.com/ash-r1)! - Preserve upload-archive sole usage arity and first-word documentation dispatch while retaining native sideband archive results.

- [#258](https://github.com/ash-r1/type-git/pull/258) [`f4b8367`](https://github.com/ash-r1/type-git/commit/f4b8367edff562131262b4d9a67aef968e936680) Thanks [@ash-r1](https://github.com/ash-r1)! - Accept archive-writer sole usage words while preserving exact one-repository arity and first-word documentation dispatch.

- [#232](https://github.com/ash-r1/type-git/pull/232) [`238b91e`](https://github.com/ash-r1/type-git/commit/238b91e1c562645df5f80ae3c602ad7655393f01) Thanks [@ash-r1](https://github.com/ash-r1)! - Match native internal help and sole-word completion parsing in column, fmt-merge-msg and update-ref while preserving earlier callback errors.

- [#257](https://github.com/ash-r1/type-git/pull/257) [`e828628`](https://github.com/ash-r1/type-git/commit/e8286281d4c46bbc4bd8234e174d7a14094bf0d5) Thanks [@ash-r1](https://github.com/ash-r1)! - Accept sole `git var -h` and `--help-all` usage words while preserving one-word variable queries and listing validation.

## 0.5.0

### Minor Changes

- [#129](https://github.com/ash-r1/type-git/pull/129) [`b279425`](https://github.com/ash-r1/type-git/commit/b2794250531b096b8206dc6fb42d78adf795c634) Thanks [@ash-r1](https://github.com/ash-r1)! - Derive typed option validation from an evidence-backed declarative constraint model. Add deterministic finite-domain exploration, generated clone type cases, and independent Git conformance tests.

  Remove overly strict restrictions on Git-supported flag combinations, preserve Git's argument precedence, and add missing clone filter prerequisites and other documented Git constraints. Allow zero parallel jobs and zero deepen values. Forward compatible sequencer control options instead of discarding them.

  Some previously accepted invalid combinations now fail earlier, including submodule filtering without its prerequisites, delete pushes without refs, incompatible commit message sources, and orphan worktree options. Every modeled restriction now records whether it comes from Git or a documented typed API exception.

  Preserve boolean ls-tree abbreviation, check literal command constraints against normalized option state, and distinguish excess option values from unknown flags.

- [#129](https://github.com/ash-r1/type-git/pull/129) [`b279425`](https://github.com/ash-r1/type-git/commit/b2794250531b096b8206dc6fb42d78adf795c634) Thanks [@ash-r1](https://github.com/ash-r1)! - Add deterministic decision-diagram exploration and compiler witnesses for every modelled option family, and a version-pinned upstream command audit ledger. Enforce evidenced reset, stash, tag, remote, submodule and LFS constraints; forward LFS conflict checkout, lock verification and migrate options correctly. LFS migration now separates mode-specific options and exposes positional refs/files.

- [#194](https://github.com/ash-r1/type-git/pull/194) [`b2ed982`](https://github.com/ash-r1/type-git/commit/b2ed982315fab0d910825db8bca1b875c1609d38) Thanks [@ash-r1](https://github.com/ash-r1)! - `revParse(ref, { verify: true, quiet: true })` now returns `undefined` when the ref cannot be resolved (for example, a commit that does not exist) instead of throwing a `GitError`. Other failures, such as running outside a repository, still throw. The return type of this overload is `Promise<string | undefined>`.

  `quiet` now requires `verify`, matching Git, which only honors `--quiet` in `--verify` mode. Passing `quiet` without `verify` is a type error and throws `GitArgumentError` at runtime.

- [#129](https://github.com/ash-r1/type-git/pull/129) [`b279425`](https://github.com/ash-r1/type-git/commit/b2794250531b096b8206dc6fb42d78adf795c634) Thanks [@ash-r1](https://github.com/ash-r1)! - Add ordered, typed CLI command access to global, worktree, and bare clients. Generate Git LFS registrations and native Git option tables from pinned upstream sources, validate declarative option/operand constraints at compile time and runtime, and publish deterministic finite-state exploration and coverage records.

## 0.4.0

This release tightens public input/output contracts and includes breaking type changes.
See the [0.4.0 migration guide](docs/migrations/0.4.0.md) before upgrading.

### Minor Changes

- [`ba48835`](https://github.com/ash-r1/type-git/commit/ba488351c32bf67b52a7079527520815b25d9035) Add audit mode for command lifecycle tracking

  New `audit` configuration option in `createGit()` provides hooks for observing Git command execution:

  - `onAudit(event)`: Receives start/end events for every Git command
  - `onTrace(trace)`: Receives GIT_TRACE output lines when enabled

  Example usage:

  ```typescript
  const git = await createGit({
    adapters: createNodeAdapters(),
    audit: {
      onAudit: (event) => {
        if (event.type === 'start') {
          console.log(`Starting: ${event.argv.join(' ')}`);
        } else {
          console.log(`Completed in ${event.duration}ms (exit ${event.exitCode})`);
        }
      },
      onTrace: (trace) => {
        console.log(`[GIT_TRACE] ${trace.line}`);
      },
    },
  });
  ```

  Types exported: `AuditEvent`, `AuditEventStart`, `AuditEventEnd`, `TraceEvent`, `AuditConfig`

- [`44f4e09`](https://github.com/ash-r1/type-git/commit/44f4e099f2196e53601d1ae1bd1fc11e3a5a0ad2) Forward `onLfsProgress` callback through `clone` and `push`

  `onLfsProgress` was already accepted on these methods' option types but was
  not wired to the runner. LFS transfer progress is now reported during
  `git.clone()` (downloads) and `repo.push()` (uploads), matching existing
  `onProgress` behavior.

- [`057469d`](https://github.com/ash-r1/type-git/commit/057469d625dc71f963fe5f4b6c4e600a57089033) Stop implicitly inheriting the full parent process environment (environment variable traversal prevention)

  Previously, every spawned Git command inherited the entire parent process environment. This leaked secrets that happen to live in the parent process (cloud credentials, API tokens, etc.) into Git and any tools it shells out to — credential helpers, hooks, and LFS transfer agents — which is an environment variable traversal risk.

  Now, only a curated allowlist of variables that Git genuinely needs to operate (e.g. `PATH`, `HOME`, locale, `SSH_AUTH_SOCK`, proxy settings, and Windows essentials) is inherited by default. Sensitive variables are no longer forwarded.

  A new `inheritEnv` option controls this behavior on `createGit()`, `git.open()`/`openBare()`/`openRaw()`, and `CliRunner`:

  - `undefined` (default): inherit only the built-in safe allowlist (`DEFAULT_ENV_ALLOWLIST`).
  - `true`: inherit the entire parent environment (previous behavior, opt-in).
  - `false`: inherit nothing beyond explicitly provided `env`.
  - `string[]`: inherit the default allowlist plus the named variables.

  ```typescript
  // Opt a specific variable back in
  const git = await createGit({
    adapters: createNodeAdapters(),
    inheritEnv: ['MY_CUSTOM_VAR'],
  });

  // Restore the previous "inherit everything" behavior
  const repo = await git.open('/path/to/repo', { inheritEnv: true });
  ```

  **Breaking:** Workflows that relied on arbitrary parent environment variables reaching Git (for example a commit-signing or credential helper that reads a token from the environment) must now opt those variables back in via `inheritEnv`.

  New exports: `EnvInheritance`, `DEFAULT_ENV_ALLOWLIST`, `resolveInheritedEnv`.

- [`49edd4e`](https://github.com/ash-r1/type-git/commit/49edd4ec68fd01adbb1e2999b24d415b85c29ad6) Add deny-list and predicate forms to `inheritEnv`

  `inheritEnv` previously only accepted `true` / `false` / `string[]`, so the
  default allowlist could be extended but never trimmed — dropping a single
  default entry (e.g. `SSH_AUTH_SOCK` for an HTTPS-only app) meant rebuilding the
  whole list by hand.

  Two new forms are now supported:

  - `{ add?: string[]; remove?: string[] }` — start from the default allowlist,
    add `add`, then subtract `remove` (`remove` wins on conflicts). For example
    `inheritEnv: { remove: ['SSH_AUTH_SOCK', 'SSH_AGENT_PID'] }`.
  - `(name: string) => boolean` — a predicate that decides each variable
    individually, bypassing the default allowlist entirely.

  `DEFAULT_ENV_ALLOWLIST` documentation now also calls out that the SSH agent vars
  (`SSH_AUTH_SOCK` / `SSH_AGENT_PID`) are included by default (and how to drop
  them), while the most credential-prone helpers (`GIT_ASKPASS` / `SSH_ASKPASS` /
  `GIT_PROXY_COMMAND`) are intentionally excluded.

- [`3fcf335`](https://github.com/ash-r1/type-git/commit/3fcf335ddbf9726ca6bbee5adddd40e435ac9e0e) Forward `onLfsProgress` through `pull` and the LFS transfer operations

  `onLfsProgress` was accepted on these methods' option types (via `ExecOpts`)
  but was never wired to the runner, so the callback silently never fired.
  LFS transfer progress is now reported during `repo.pull()`, `repo.lfs.pull()`,
  `repo.lfs.push()`, `repo.lfs.fetch()`, `repo.lfsExtra.preUpload()` and
  `repo.lfsExtra.preDownload()`, matching the existing `clone` / `push` behavior.

  The `--progress` enablement gate was also broadened from `onProgress` to
  `onProgress || onLfsProgress` (in `clone`, `push`, `pull` and `lfs.fetch`) so
  that passing only `onLfsProgress` still requests progress output.

- [`e9a7f67`](https://github.com/ash-r1/type-git/commit/e9a7f6702529b589b422fa7366769c93b6c5c8b9) Honor the object-form LFS mode (`open({ lfs: { skipSmudge } })`)

  Previously the object form of `LfsMode` (`{ skipSmudge?, skipDownload? }`) was
  stored but never consulted — only the string `'disabled'` had any effect, so
  `open({ lfs: { skipSmudge: true } })` was a silent no-op and checkout/pull still
  smudged LFS files.

  Now, when a repository is opened (or reconfigured via `setLfsMode`) with an
  object-form mode requesting `skipSmudge` and/or `skipDownload`, the
  working-tree-populating operations — `checkout`, `switch`, `reset`, `merge`,
  `pull`, `rebase` and `restore` — run with `GIT_LFS_SKIP_SMUDGE=1`. Git leaves
  LFS pointer files in place instead of downloading their contents. The objects
  can be materialized later via the explicit `repo.lfs.pull()` /
  `repo.lfs.checkout()` helpers, which use dedicated git-lfs commands and are not
  affected by the variable.

- [`98ef83e`](https://github.com/ash-r1/type-git/commit/98ef83e0ddbf84d4ee322993add2e058ca7aa7f0) Run `lfsExtra.preUpload()` batches concurrently and raise the default batch size

  Each `git lfs push --object-id` invocation pays a fixed cost (process spawn,
  credential lookup, LFS batch API round-trip) before any bytes are transferred.
  Previously the batches ran strictly one after another, so with many objects
  this fixed cost accumulated as pure waiting time. Batches now run with a
  bounded concurrency (new `concurrency` option, default 4; set 1 for the
  previous serial behavior), overlapping the fixed cost with other batches'
  transfers.

  Two related behaviors are defined precisely:

  - The first batch always runs alone; the remaining batches start only after
    it succeeds. A failure that affects every batch the same way (unreachable
    remote, missing local objects) is discovered with a single round-trip.
  - Once a batch fails or is aborted, no new batch is started; in-flight
    batches are awaited before returning. The objects of failed and unstarted
    batches are reported in `skippedCount`, so `uploadedCount + skippedCount`
    still equals the number of objects. Previously, every remaining batch was
    still attempted after a failure.

  The default `batchSize` is raised from 50 to 200. Git is spawned directly
  without a shell, so the binding command-line limit is the Windows
  CreateProcess limit of 32,767 characters rather than the 8KB shell limit the
  old default assumed; 200 OIDs stay around 40% of the real limit while paying
  the per-invocation fixed cost a quarter as often.

- [`f20036e`](https://github.com/ash-r1/type-git/commit/f20036e0c1b12f185e1b9eb359f090699efdfef0) Support `repo.lfs.push({ objectId: oids, stdin: true })` with newline-delimited input across Node.js, Bun, and Deno. Fix object-ID argument ordering for LFS pushes.
- Strengthen typed Git contracts for 0.4.0. Reject conflicting options at compile time and before execution, narrow output-mode and dynamic repository return types, preserve NUL-delimited paths and commit fields, and share the complete fetch/push and config implementations across repository contexts.

  Breaking changes: filename/object-only tree queries and filename-only diffs return string arrays; dynamic bare/mirror options return a discriminated repository union; unsupported typed output formats and conflicting options require migration; log bodies retain whitespace; LFS status uses actual status codes and optional sizes. See the 0.4 migration guide.

  Fix config error propagation and multiline values, LFS JSON contracts and fetch flags, commit statistics in quiet mode, stash metadata, UTF-8 chunk decoding, and cancellation cleanup. Add Bun/Deno TypeGit entrypoints and compile-time plus cross-runtime contract tests.

### Patch Changes

- [`780c445`](https://github.com/ash-r1/type-git/commit/780c445363f0a9290b4e9578968613b651775b23) Add common Git transport configuration variables to the default environment allowlist

  Following the environment variable traversal prevention change, Git's own SSH transport and TLS configuration variables were no longer inherited by default, which could break workflows relying on them (e.g. a custom SSH command).

  The default allowlist now also inherits these Git configuration variables, which are commonly needed for transport configuration: `GIT_SSH`, `GIT_SSH_COMMAND`, `GIT_SSH_VARIANT`, `GIT_SSL_CAINFO`, `GIT_SSL_CAPATH`, `GIT_TERMINAL_PROMPT`, and `GIT_CONFIG_NOSYSTEM`. These are configuration rather than application secrets (though, depending on local setup, values such as `GIT_SSH_COMMAND` may name a command Git executes).

  Credential-carrying / askpass variables — `GIT_ASKPASS`, `SSH_ASKPASS`, and `GIT_PROXY_COMMAND` — are intentionally **not** inherited by default, since they can carry inline credentials or invoke a helper that reads secrets from the environment. Opt into those (and any other variables) explicitly via `inheritEnv` when needed.

## 0.3.0-beta.0

### Patch Changes

- Promote the 0.3.0 prerelease to beta. Document the validation scope and compatibility policy, and run repository API type assertions in CI.

## 0.3.0-alpha.3

### Minor Changes

- [#123](https://github.com/ash-r1/type-git/pull/123) [`98ef83e`](https://github.com/ash-r1/type-git/commit/98ef83e0ddbf84d4ee322993add2e058ca7aa7f0) Thanks [@ash-r1](https://github.com/ash-r1)! - Run `lfsExtra.preUpload()` batches concurrently and raise the default batch size

  Each `git lfs push --object-id` invocation pays a fixed cost (process spawn,
  credential lookup, LFS batch API round-trip) before any bytes are transferred.
  Previously the batches ran strictly one after another, so with many objects
  this fixed cost accumulated as pure waiting time. Batches now run with a
  bounded concurrency (new `concurrency` option, default 4; set 1 for the
  previous serial behavior), overlapping the fixed cost with other batches'
  transfers.

  Two related behaviors are defined precisely:

  - The first batch always runs alone; the remaining batches start only after
    it succeeds. A failure that affects every batch the same way (unreachable
    remote, missing local objects) is discovered with a single round-trip.
  - Once a batch fails or is aborted, no new batch is started; in-flight
    batches are awaited before returning. The objects of failed and unstarted
    batches are reported in `skippedCount`, so `uploadedCount + skippedCount`
    still equals the number of objects. Previously, every remaining batch was
    still attempted after a failure.

  The default `batchSize` is raised from 50 to 200. Git is spawned directly
  without a shell, so the binding command-line limit is the Windows
  CreateProcess limit of 32,767 characters rather than the 8KB shell limit the
  old default assumed; 200 OIDs stay around 40% of the real limit while paying
  the per-invocation fixed cost a quarter as often.

- [#126](https://github.com/ash-r1/type-git/pull/126) [`f20036e`](https://github.com/ash-r1/type-git/commit/f20036e0c1b12f185e1b9eb359f090699efdfef0) Thanks [@ash-r1](https://github.com/ash-r1)! - Support `repo.lfs.push({ objectId: oids, stdin: true })` with newline-delimited input across Node.js, Bun, and Deno. Fix object-ID argument ordering for LFS pushes.

## 0.3.0-alpha.2

### Minor Changes

- [#122](https://github.com/ash-r1/type-git/pull/122) [`49edd4e`](https://github.com/ash-r1/type-git/commit/49edd4ec68fd01adbb1e2999b24d415b85c29ad6) Thanks [@ash-r1](https://github.com/ash-r1)! - Add deny-list and predicate forms to `inheritEnv`

  `inheritEnv` previously only accepted `true` / `false` / `string[]`, so the
  default allowlist could be extended but never trimmed — dropping a single
  default entry (e.g. `SSH_AUTH_SOCK` for an HTTPS-only app) meant rebuilding the
  whole list by hand.

  Two new forms are now supported:

  - `{ add?: string[]; remove?: string[] }` — start from the default allowlist,
    add `add`, then subtract `remove` (`remove` wins on conflicts). For example
    `inheritEnv: { remove: ['SSH_AUTH_SOCK', 'SSH_AGENT_PID'] }`.
  - `(name: string) => boolean` — a predicate that decides each variable
    individually, bypassing the default allowlist entirely.

  `DEFAULT_ENV_ALLOWLIST` documentation now also calls out that the SSH agent vars
  (`SSH_AUTH_SOCK` / `SSH_AGENT_PID`) are included by default (and how to drop
  them), while the most credential-prone helpers (`GIT_ASKPASS` / `SSH_ASKPASS` /
  `GIT_PROXY_COMMAND`) are intentionally excluded.

- [#119](https://github.com/ash-r1/type-git/pull/119) [`3fcf335`](https://github.com/ash-r1/type-git/commit/3fcf335ddbf9726ca6bbee5adddd40e435ac9e0e) Thanks [@ash-r1](https://github.com/ash-r1)! - Forward `onLfsProgress` through `pull` and the LFS transfer operations

  `onLfsProgress` was accepted on these methods' option types (via `ExecOpts`)
  but was never wired to the runner, so the callback silently never fired.
  LFS transfer progress is now reported during `repo.pull()`, `repo.lfs.pull()`,
  `repo.lfs.push()`, `repo.lfs.fetch()`, `repo.lfsExtra.preUpload()` and
  `repo.lfsExtra.preDownload()`, matching the existing `clone` / `push` behavior.

  The `--progress` enablement gate was also broadened from `onProgress` to
  `onProgress || onLfsProgress` (in `clone`, `push`, `pull` and `lfs.fetch`) so
  that passing only `onLfsProgress` still requests progress output.

- [#120](https://github.com/ash-r1/type-git/pull/120) [`e9a7f67`](https://github.com/ash-r1/type-git/commit/e9a7f6702529b589b422fa7366769c93b6c5c8b9) Thanks [@ash-r1](https://github.com/ash-r1)! - Honor the object-form LFS mode (`open({ lfs: { skipSmudge } })`)

  Previously the object form of `LfsMode` (`{ skipSmudge?, skipDownload? }`) was
  stored but never consulted — only the string `'disabled'` had any effect, so
  `open({ lfs: { skipSmudge: true } })` was a silent no-op and checkout/pull still
  smudged LFS files.

  Now, when a repository is opened (or reconfigured via `setLfsMode`) with an
  object-form mode requesting `skipSmudge` and/or `skipDownload`, the
  working-tree-populating operations — `checkout`, `switch`, `reset`, `merge`,
  `pull`, `rebase` and `restore` — run with `GIT_LFS_SKIP_SMUDGE=1`. Git leaves
  LFS pointer files in place instead of downloading their contents. The objects
  can be materialized later via the explicit `repo.lfs.pull()` /
  `repo.lfs.checkout()` helpers, which use dedicated git-lfs commands and are not
  affected by the variable.

### Patch Changes

- [#117](https://github.com/ash-r1/type-git/pull/117) [`780c445`](https://github.com/ash-r1/type-git/commit/780c445363f0a9290b4e9578968613b651775b23) Thanks [@ash-r1](https://github.com/ash-r1)! - Add common Git transport configuration variables to the default environment allowlist

  Following the environment variable traversal prevention change, Git's own SSH transport and TLS configuration variables were no longer inherited by default, which could break workflows relying on them (e.g. a custom SSH command).

  The default allowlist now also inherits these Git configuration variables, which are commonly needed for transport configuration: `GIT_SSH`, `GIT_SSH_COMMAND`, `GIT_SSH_VARIANT`, `GIT_SSL_CAINFO`, `GIT_SSL_CAPATH`, `GIT_TERMINAL_PROMPT`, and `GIT_CONFIG_NOSYSTEM`. These are configuration rather than application secrets (though, depending on local setup, values such as `GIT_SSH_COMMAND` may name a command Git executes).

  Credential-carrying / askpass variables — `GIT_ASKPASS`, `SSH_ASKPASS`, and `GIT_PROXY_COMMAND` — are intentionally **not** inherited by default, since they can carry inline credentials or invoke a helper that reads secrets from the environment. Opt into those (and any other variables) explicitly via `inheritEnv` when needed.

## 0.3.0-alpha.1

### Minor Changes

- [#115](https://github.com/ash-r1/type-git/pull/115) [`057469d`](https://github.com/ash-r1/type-git/commit/057469d625dc71f963fe5f4b6c4e600a57089033) Thanks [@ash-r1](https://github.com/ash-r1)! - Stop implicitly inheriting the full parent process environment (environment variable traversal prevention)

  Previously, every spawned Git command inherited the entire parent process environment. This leaked secrets that happen to live in the parent process (cloud credentials, API tokens, etc.) into Git and any tools it shells out to — credential helpers, hooks, and LFS transfer agents — which is an environment variable traversal risk.

  Now, only a curated allowlist of variables that Git genuinely needs to operate (e.g. `PATH`, `HOME`, locale, `SSH_AUTH_SOCK`, proxy settings, and Windows essentials) is inherited by default. Sensitive variables are no longer forwarded.

  A new `inheritEnv` option controls this behavior on `createGit()`, `git.open()`/`openBare()`/`openRaw()`, and `CliRunner`:

  - `undefined` (default): inherit only the built-in safe allowlist (`DEFAULT_ENV_ALLOWLIST`).
  - `true`: inherit the entire parent environment (previous behavior, opt-in).
  - `false`: inherit nothing beyond explicitly provided `env`.
  - `string[]`: inherit the default allowlist plus the named variables.

  ```typescript
  // Opt a specific variable back in
  const git = await createGit({
    adapters: createNodeAdapters(),
    inheritEnv: ['MY_CUSTOM_VAR'],
  });

  // Restore the previous "inherit everything" behavior
  const repo = await git.open('/path/to/repo', { inheritEnv: true });
  ```

  **Breaking:** Workflows that relied on arbitrary parent environment variables reaching Git (for example a commit-signing or credential helper that reads a token from the environment) must now opt those variables back in via `inheritEnv`.

  New exports: `EnvInheritance`, `DEFAULT_ENV_ALLOWLIST`, `resolveInheritedEnv`.

## 0.3.0-alpha.0

### Minor Changes

- [#112](https://github.com/ash-r1/type-git/pull/112) [`ba48835`](https://github.com/ash-r1/type-git/commit/ba488351c32bf67b52a7079527520815b25d9035) Thanks [@ash-r1](https://github.com/ash-r1)! - Add audit mode for command lifecycle tracking

  New `audit` configuration option in `createGit()` provides hooks for observing Git command execution:

  - `onAudit(event)`: Receives start/end events for every Git command
  - `onTrace(trace)`: Receives GIT_TRACE output lines when enabled

  Example usage:

  ```typescript
  const git = await createGit({
    adapters: createNodeAdapters(),
    audit: {
      onAudit: (event) => {
        if (event.type === 'start') {
          console.log(`Starting: ${event.argv.join(' ')}`);
        } else {
          console.log(`Completed in ${event.duration}ms (exit ${event.exitCode})`);
        }
      },
      onTrace: (trace) => {
        console.log(`[GIT_TRACE] ${trace.line}`);
      },
    },
  });
  ```

  Types exported: `AuditEvent`, `AuditEventStart`, `AuditEventEnd`, `TraceEvent`, `AuditConfig`

- [#114](https://github.com/ash-r1/type-git/pull/114) [`44f4e09`](https://github.com/ash-r1/type-git/commit/44f4e099f2196e53601d1ae1bd1fc11e3a5a0ad2) Thanks [@ash-r1](https://github.com/ash-r1)! - Forward `onLfsProgress` callback through `clone` and `push`

  `onLfsProgress` was already accepted on these methods' option types but was
  not wired to the runner. LFS transfer progress is now reported during
  `git.clone()` (downloads) and `repo.push()` (uploads), matching existing
  `onProgress` behavior.

## 0.2.0

### Minor Changes

- [#110](https://github.com/ash-r1/type-git/pull/110) [`1874124`](https://github.com/ash-r1/type-git/commit/187412417648551e88d8263e690d53bb28c98a13) Thanks [@ash-r1](https://github.com/ash-r1)! - Add `await using` support with `Symbol.asyncDispose` for automatic resource cleanup

  - `SpawnHandle` now implements `AsyncDisposable`, allowing automatic process cleanup with `await using`
  - `TailHandle` now implements `AsyncDisposable`, allowing automatic file handle cleanup with `await using`
  - Added `ESNext.Disposable` to TypeScript lib configuration
  - Backward compatible: existing `kill()` and `stop()` methods continue to work as before

  Example usage:

  ```typescript
  // Automatic cleanup when scope exits (new)
  await using handle = adapter.spawnStreaming({ argv: ['git', 'fetch'] });
  for await (const line of handle.stdout) {
    console.log(line);
  }
  // Process automatically terminated and cleaned up

  // Traditional usage still works (existing)
  const handle = adapter.spawnStreaming({ argv: ['git', 'fetch'] });
  try {
    for await (const line of handle.stdout) {
      console.log(line);
    }
  } finally {
    handle.kill();
  }
  ```

## 0.1.1

### Patch Changes

- [#105](https://github.com/ash-r1/type-git/pull/105) [`9118d58`](https://github.com/ash-r1/type-git/commit/9118d58f94fd86ef780f65f25a100c2b5ed20715) Thanks [@ash-r1](https://github.com/ash-r1)! - Fix parseGitLog hash field not being trimmed when previous commit body ends with newline

## 0.1.0

### Minor Changes

- [#84](https://github.com/ash-r1/type-git/pull/84) [`b3a6260`](https://github.com/ash-r1/type-git/commit/b3a6260974b72ca4bb0d4735d46fa8e078931daa) Thanks [@ash-r1](https://github.com/ash-r1)! - Add Git version check on initialization

  - Add `TypeGit.create()` static method that performs Git version validation
  - Require Git 2.30.0+ by default (recommended for modern distributions)
  - Add `useLegacyVersion` option to allow Git 2.25.0+ (e.g., Ubuntu 20.04 LTS default)
  - Throw `GitError` with kind `UnsupportedGitVersion` if Git version is below minimum
  - Deprecate constructor in favor of `TypeGit.create()` for version safety
  - Add CI test for legacy Git 2.25.x compatibility

### Patch Changes

- [#93](https://github.com/ash-r1/type-git/pull/93) [`4b54b1d`](https://github.com/ash-r1/type-git/commit/4b54b1dd32d14fc46dd40507fcc6b69444b39a86) Thanks [@ash-r1](https://github.com/ash-r1)! - Fix biome lint warnings by moving regex literals to top-level constants and removing unnecessary async modifiers

- [#90](https://github.com/ash-r1/type-git/pull/90) [`6c9b01c`](https://github.com/ash-r1/type-git/commit/6c9b01cf841efabedd11bdb553955e59422a1232) Thanks [@ash-r1](https://github.com/ash-r1)! - Fix npm OIDC trusted publishing by updating to npm 11.5.1+

- [#97](https://github.com/ash-r1/type-git/pull/97) [`552e6c4`](https://github.com/ash-r1/type-git/commit/552e6c4b61bbe9eb294d3bf53d5db6894a787cc8) Thanks [@ash-r1](https://github.com/ash-r1)! - refactor: extract shared file polling logic to reduce cognitive complexity

  - Created `src/internal/file-polling.ts` shared module with `FilePollingAdapter` interface
  - Refactored `tail` and `tailStreaming` methods in Node.js, Bun, and Deno adapters to use the shared polling logic
  - Reduced code duplication across runtime adapters by ~70%
  - Eliminated 4 cognitive complexity warnings from Biome linter

- [#98](https://github.com/ash-r1/type-git/pull/98) [`79c8702`](https://github.com/ash-r1/type-git/commit/79c8702b91008ed370cf4900b8676f27b1300397) Thanks [@ash-r1](https://github.com/ash-r1)! - refactor: reduce cognitive complexity in remoteList, clone, and progress handling

  - Extract `parseRemoteLine`, `updateRemoteUrl`, `normalizeRemoteUrls` helpers for `remoteList`
  - Move regex patterns to top-level constants
  - Create `buildCloneArgs` helper using Options Map pattern for `clone` method
  - Extract `toLfsProgress`, `toGitProgress`, `processProgressLine` helpers for stderr progress handling
  - Reduces code duplication and improves maintainability

## 0.0.1

### Patch Changes

- [#81](https://github.com/ash-r1/type-git/pull/81) [`9aa2cb9`](https://github.com/ash-r1/type-git/commit/9aa2cb98f1304c5e1487bf7b1aeab6265f4e377a) Thanks [@ash-r1](https://github.com/ash-r1)! - Add lsTree method to RepoBase

  - Add `lsTree()` method to WorktreeRepo and BareRepo
  - Support options: `recursive`, `tree`, `path`, etc.
  - Return parsed tree entries with mode, type, hash, and path

- [#79](https://github.com/ash-r1/type-git/pull/79) [`debea12`](https://github.com/ash-r1/type-git/commit/debea12807c7dc67cc4fab0bb93678bff3942229) Thanks [@ash-r1](https://github.com/ash-r1)! - Add repository-scoped lsRemote method

  - Add `lsRemote()` method to WorktreeRepo and BareRepo
  - Enables listing remote references from within a repository context
  - Supports same options as `git.lsRemote()` with automatic remote resolution

- [#82](https://github.com/ash-r1/type-git/pull/82) [`7b7d1c6`](https://github.com/ash-r1/type-git/commit/7b7d1c64575b9fcd425ff0d382f1da4312615b3a) Thanks [@ash-r1](https://github.com/ash-r1)! - Add rev-parse with comprehensive options support

  - Add `revParse()` method to WorktreeRepo and BareRepo
  - Support various rev-parse options: `abbrevRef`, `symbolic`, `short`, `verify`, etc.
  - Parse output based on option combinations for type-safe results

- [#86](https://github.com/ash-r1/type-git/pull/86) [`6d0ebda`](https://github.com/ash-r1/type-git/commit/6d0ebda2dea78f3dc0dbd0147318acbd5ea7daa6) Thanks [@ash-r1](https://github.com/ash-r1)! - Add dual package support (ESM + CommonJS) using tsup

  - Build outputs both `.js` (ESM) and `.cjs` (CommonJS) formats
  - Add proper `require` and `import` conditions to package.json exports
  - Enable `require('type-git')` for CommonJS projects
  - Works with all `moduleResolution` settings (`bundler`, `node16`, `nodenext`)
