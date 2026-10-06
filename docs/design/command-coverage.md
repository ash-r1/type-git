# Upstream command coverage

Baseline: Git 2.55.0; Git LFS 3.8.0.

Version-pinned upstream commands, registered aliases/helpers, and companion programs. Site-installed git-* extensions cannot be enumerated globally.

**Inventory is not implementation coverage.** Entries without an audit record are pending. A finite model count is not proof that upstream constraints were fully discovered.

Inventory contains 221 entries; the table also includes individually reviewed operation scopes. Candidate nested dispatch names are retained in the JSON inventory, not counted as audited operations.

| Command / operation | Classification | Audit | Typed CLI | Models | Remaining work |
| --- | --- | --- | --- | --- | --- |
| `add` | documented | partial | yes | add | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `am` | documented | partial | yes |  | Session/configuration-dependent operands and defaults, delegated apply parser (only reached for actual patch application), mail/patch formats, binary I/O and abbreviations. Interactive operand requirements depend on session state; no unconditional rule is imposed. |
| `annotate` | documented | pending | pending |  | Audit every applicable facet. |
| `apply` | documented | partial | yes |  | Patch content/index/repository conditions, path normalization, numeric lexical spellings, abbreviations and binary I/O. Git 2.55 negated whitespace/directory callbacks abort the process; these two spellings are deliberately omitted (documented wrapper exception). |
| `archimport` | documented | pending | pending |  | Audit every applicable facet. |
| `archive` | documented | pending | pending |  | Audit every applicable facet. |
| `backfill` | documented | pending | pending |  | Audit every applicable facet. |
| `bisect` | documented | pending | pending |  | Audit every applicable facet. |
| `blame` | documented | pending | pending |  | Audit every applicable facet. |
| `branch` | documented | partial | yes |  | Column callback grammar; object/filter value grammars; repository-dependent tracking and recursion; abbreviations and option clustering. |
| `bugreport` | documented | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. Upstream diagnose with --no-suffix requires separate audit; no extra wrapper prohibition is invented. |
| `bundle` | documented | pending | pending |  | Audit every applicable facet. |
| `cat-file` | documented | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `check-attr` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `check-ignore` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `check-mailmap` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `check-ref-format` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `checkout` | documented | partial | yes | checkoutBranch, checkoutPath | Repository-dependent revision/path disambiguation and DWIM tracking; remaining path/branch-mode guards; callback grammars and abbreviations. |
| `checkout--worker` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `checkout-index` | documented | partial | yes |  | Repository and index state, object/path validity, merge-strategy and recursion callbacks, numeric lexical forms, binary and stdin protocols, abbreviations and witnesses for every rule. |
| `cherry` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `cherry-pick` | documented | partial | yes | cherryPick | Revision/object resolution, multipass ordering, configuration-driven sequencer state, callback grammars and revision shorthand. |
| `citool` | documented | pending | pending |  | Audit every applicable facet. |
| `clean` | documented | partial | yes | clean | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `clone` | documented | partial | yes | clone | Depth and transport value grammars, repository/configuration conditions, abbreviations, transport-specific callbacks. |
| `column` | documented | partial | yes |  | First --command spelling versus final command value and column-mode callbacks; configuration, numeric lexical forms, abbreviations and witnesses. |
| `commit` | documented | partial | yes | commit | Cleanup/fixup value grammars, repository-dependent author/content modes, callbacks and abbreviations. |
| `commit-graph` | documented | pending | pending |  | Audit every applicable facet. |
| `commit-graph verify` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `commit-graph write` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `commit-tree` | documented | partial | yes |  | Tree and parent object validity, signing/configuration, message-file and binary stdin protocols, abbreviations. |
| `config` | documented | pending | pending |  | Audit every applicable facet. |
| `config edit` | reviewed-scope | partial | yes |  | Config key/regexp/URL/comment grammars; value normalization; environment-provided sources; repository/file state; abbreviations. Legacy root dispatch is a separate audit. |
| `config get` | reviewed-scope | partial | yes | configGet | Config key/regexp/URL/comment grammars; value normalization; environment-provided sources; repository/file state; abbreviations. Legacy root dispatch is a separate audit. |
| `config list` | reviewed-scope | partial | yes | configList | Config key/regexp/URL/comment grammars; value normalization; environment-provided sources; repository/file state; abbreviations. Legacy root dispatch is a separate audit. |
| `config remove-section` | reviewed-scope | partial | yes |  | Config key/regexp/URL/comment grammars; value normalization; environment-provided sources; repository/file state; abbreviations. Legacy root dispatch is a separate audit. |
| `config rename-section` | reviewed-scope | partial | yes |  | Config key/regexp/URL/comment grammars; value normalization; environment-provided sources; repository/file state; abbreviations. Legacy root dispatch is a separate audit. |
| `config set` | reviewed-scope | partial | yes |  | Config key/regexp/URL/comment grammars; value normalization; environment-provided sources; repository/file state; abbreviations. Legacy root dispatch is a separate audit. |
| `config unset` | reviewed-scope | partial | yes |  | Config key/regexp/URL/comment grammars; value normalization; environment-provided sources; repository/file state; abbreviations. Legacy root dispatch is a separate audit. |
| `count-objects` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `credential` | documented | pending | pending |  | Audit every applicable facet. |
| `credential-cache` | documented | pending | pending |  | Audit every applicable facet. |
| `credential-cache--daemon` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `credential-store` | documented | pending | pending |  | Audit every applicable facet. |
| `cvsexportcommit` | documented | pending | pending |  | Audit every applicable facet. |
| `cvsimport` | documented | pending | pending |  | Audit every applicable facet. |
| `cvsserver` | documented | pending | pending |  | Audit every applicable facet. |
| `daemon` | documented | pending | pending |  | Audit every applicable facet. |
| `describe` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `diagnose` | documented | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `diff` | documented | partial | yes | diff | Revision/object/path resolution, numeric shorthand, --end-of-options and command-specific multi-pass parsing; configuration-dependent defaults, callback languages, implicit no-index dispatch, follow/pathspec conditions and binary output. Git 2.55.0 oldest traversal crashes for a negative final count; recorded separately from argument rejection. |
| `diff --no-index` | reviewed-scope | partial | yes |  | Filesystem-dependent file/directory operand rules, pathspec grammar, callback argument languages and binary output. |
| `diff-files` | documented | partial | yes |  | Revision/object/path resolution, numeric shorthand, --end-of-options and command-specific multi-pass parsing; configuration-dependent defaults, callback languages, implicit no-index dispatch, follow/pathspec conditions and binary output. Git 2.55.0 oldest traversal crashes for a negative final count; recorded separately from argument rejection. |
| `diff-index` | documented | partial | yes |  | Revision/object/path resolution, numeric shorthand, --end-of-options and command-specific multi-pass parsing; configuration-dependent defaults, callback languages, implicit no-index dispatch, follow/pathspec conditions and binary output. Git 2.55.0 oldest traversal crashes for a negative final count; recorded separately from argument rejection. |
| `diff-pairs` | documented | pending | pending |  | Audit every applicable facet. |
| `diff-tree` | documented | partial | yes |  | Revision/object/path resolution, numeric shorthand, --end-of-options and command-specific multi-pass parsing; configuration-dependent defaults, callback languages, implicit no-index dispatch, follow/pathspec conditions and binary output. Git 2.55.0 oldest traversal crashes for a negative final count; recorded separately from argument rejection. |
| `difftool` | documented | pending | pending |  | Audit every applicable facet. |
| `fast-export` | documented | pending | pending |  | Audit every applicable facet. |
| `fast-import` | documented | pending | pending |  | Audit every applicable facet. |
| `fetch` | documented | partial | yes | fetch | Remote groups and repository-dependent multiple mode, transport negotiation, callback value grammars and abbreviations. |
| `fetch-pack` | documented | pending | pending |  | Audit every applicable facet. |
| `filter-branch` | documented | pending | pending |  | Audit every applicable facet. |
| `fmt-merge-msg` | documented | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `for-each-ref` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `for-each-repo` | documented | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `format-patch` | documented | pending | pending |  | Audit every applicable facet. |
| `format-rev` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `fsck` | documented | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `fsck-objects` | builtin-undocumented | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `fsmonitor--daemon` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `gc` | documented | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `get-tar-commit-id` | documented | pending | pending |  | Audit every applicable facet. |
| `gitk` | companion | pending | pending |  | Audit every applicable facet. |
| `gitweb` | companion | pending | pending |  | Audit every applicable facet. |
| `grep` | documented | pending | pending |  | Audit every applicable facet. |
| `gui` | documented | pending | pending |  | Audit every applicable facet. |
| `hash-object` | documented | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `help` | documented | pending | pending |  | Audit every applicable facet. |
| `history` | documented | pending | pending |  | Audit every applicable facet. |
| `hook` | documented | pending | pending |  | Audit every applicable facet. |
| `http-backend` | documented | pending | pending |  | Audit every applicable facet. |
| `http-fetch` | documented | pending | pending |  | Audit every applicable facet. |
| `http-push` | documented | pending | pending |  | Audit every applicable facet. |
| `imap-send` | documented | pending | pending |  | Audit every applicable facet. |
| `index-pack` | documented | pending | pending |  | Audit every applicable facet. |
| `init` | documented | partial | yes | init | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `init-db` | builtin-undocumented | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `instaweb` | documented | pending | pending |  | Audit every applicable facet. |
| `interpret-trailers` | documented | pending | pending |  | Audit every applicable facet. |
| `last-modified` | documented | pending | pending |  | Audit every applicable facet. |
| `lfs` | reviewed-scope | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs checkout` | lfs-registered | partial | yes | lfsCheckout | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs clean` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs clone` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs completion` | lfs-dispatcher | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs dedup` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs env` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs ext` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs ext list` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs fetch` | lfs-registered | partial | yes | lfsFetch | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs filter-process` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs fsck` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs help` | lfs-dispatcher | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs install` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs install hooks` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs lock` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs locks` | lfs-registered | partial | yes | lfsLocks | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs logs` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs logs boomtown` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs logs clear` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs logs last` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs logs show` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs ls-files` | lfs-registered | partial | yes | lfsLsFiles | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs merge-driver` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs migrate` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs migrate export` | lfs-registered | partial | yes | lfsMigrateExport | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs migrate import` | lfs-registered | partial | yes | lfsMigrateImport | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs migrate info` | lfs-registered | partial | yes | lfsMigrateInfo | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs pointer` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs post-checkout` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs post-commit` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs post-merge` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs pre-push` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs prune` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs pull` | lfs-registered | partial | yes | lfsPull | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs push` | lfs-registered | partial | yes | lfsPush | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs smudge` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs standalone-file` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs status` | lfs-registered | partial | yes | lfsStatus | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs track` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs uninstall` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs uninstall hooks` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs unlock` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs untrack` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs update` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `lfs version` | lfs-registered | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `log` | documented | partial | yes | log | Revision/object/path resolution, numeric shorthand, --end-of-options and command-specific multi-pass parsing; configuration-dependent defaults, callback languages, implicit no-index dispatch, follow/pathspec conditions and binary output. Git 2.55.0 oldest traversal crashes for a negative final count; recorded separately from argument rejection. |
| `ls-files` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `ls-remote` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `ls-tree` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `mailinfo` | documented | pending | pending |  | Audit every applicable facet. |
| `mailsplit` | documented | pending | pending |  | Audit every applicable facet. |
| `maintenance` | documented | pending | pending |  | Audit every applicable facet. |
| `maintenance is-needed` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `maintenance register` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `maintenance run` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `maintenance start` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `maintenance stop` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `maintenance unregister` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `merge` | documented | partial | yes | merge | Configuration defaults, strategy discovery, message-file callbacks, unborn HEAD and merge-in-progress conditions, abbreviations. |
| `merge-base` | documented | partial | yes |  | Object and ref resolution, fork-point reflog state and abbreviated option spellings. |
| `merge-file` | documented | partial | yes |  | Repository and index state, object/path validity, merge-strategy and recursion callbacks, numeric lexical forms, binary and stdin protocols, abbreviations and witnesses for every rule. |
| `merge-index` | documented | pending | pending |  | Audit every applicable facet. |
| `merge-one-file` | documented | pending | pending |  | Audit every applicable facet. |
| `merge-ours` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `merge-recursive` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `merge-recursive-ours` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `merge-recursive-theirs` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `merge-subtree` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `merge-tree` | documented | partial | yes |  | Repository and index state, object/path validity, merge-strategy and recursion callbacks, numeric lexical forms, binary and stdin protocols, abbreviations and witnesses for every rule. |
| `mergetool` | documented | pending | pending |  | Audit every applicable facet. |
| `mktag` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `mktree` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `multi-pack-index` | documented | pending | pending |  | Audit every applicable facet. |
| `multi-pack-index compact` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `multi-pack-index expire` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `multi-pack-index repack` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `multi-pack-index verify` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `multi-pack-index write` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `mv` | documented | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `name-rev` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `notes` | documented | partial | yes |  | Repository/configuration and object-dependent behavior, callback value grammars, option abbreviations, and independent witnesses for every combination. |
| `notes add` | reviewed-scope | partial | yes |  | Repository/configuration and object-dependent behavior, callback value grammars, option abbreviations, and independent witnesses for every combination. |
| `notes append` | reviewed-scope | partial | yes |  | Repository/configuration and object-dependent behavior, callback value grammars, option abbreviations, and independent witnesses for every combination. |
| `notes copy` | reviewed-scope | partial | yes |  | Repository/configuration and object-dependent behavior, callback value grammars, option abbreviations, and independent witnesses for every combination. |
| `notes edit` | reviewed-scope | partial | yes |  | Repository/configuration and object-dependent behavior, callback value grammars, option abbreviations, and independent witnesses for every combination. |
| `notes get-ref` | reviewed-scope | partial | yes |  | Repository/configuration and object-dependent behavior, callback value grammars, option abbreviations, and independent witnesses for every combination. |
| `notes list` | reviewed-scope | partial | yes |  | Repository/configuration and object-dependent behavior, callback value grammars, option abbreviations, and independent witnesses for every combination. |
| `notes merge` | reviewed-scope | partial | yes |  | Repository/configuration and object-dependent behavior, callback value grammars, option abbreviations, and independent witnesses for every combination. |
| `notes prune` | reviewed-scope | partial | yes |  | Repository/configuration and object-dependent behavior, callback value grammars, option abbreviations, and independent witnesses for every combination. |
| `notes remove` | reviewed-scope | partial | yes |  | Repository/configuration and object-dependent behavior, callback value grammars, option abbreviations, and independent witnesses for every combination. |
| `notes show` | reviewed-scope | partial | yes |  | Repository/configuration and object-dependent behavior, callback value grammars, option abbreviations, and independent witnesses for every combination. |
| `p4` | documented | pending | pending |  | Audit every applicable facet. |
| `pack-objects` | documented | pending | pending |  | Audit every applicable facet. |
| `pack-redundant` | documented | pending | pending |  | Audit every applicable facet. |
| `pack-refs` | documented | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `patch-id` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `pickaxe` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `prune` | documented | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `prune-packed` | documented | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `pull` | documented | partial | pending | pull | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `push` | documented | partial | yes | push | Remote/refspec resolution, protocol negotiation, push-option value grammar, callback grammars and abbreviations. |
| `quiltimport` | documented | pending | pending |  | Audit every applicable facet. |
| `range-diff` | documented | pending | pending |  | Audit every applicable facet. |
| `read-tree` | documented | partial | yes |  | Repository and index state, object/path validity, merge-strategy and recursion callbacks, numeric lexical forms, binary and stdin protocols, abbreviations and witnesses for every rule. |
| `rebase` | documented | partial | yes | rebase | Configuration/in-progress backend state, exec/trailer/whitespace/-C value languages, revision resolution and repository conditions. |
| `receive-pack` | documented | pending | pending |  | Audit every applicable facet. |
| `reflog` | documented | pending | pending |  | Audit every applicable facet. |
| `reflog delete` | reviewed-scope | partial | yes |  | Reference/OID syntax and repository resolution, expiry-date callbacks, root dispatch, configuration/version behavior and abbreviations. |
| `reflog drop` | reviewed-scope | partial | yes |  | Reference/OID syntax and repository resolution, expiry-date callbacks, root dispatch, configuration/version behavior and abbreviations. |
| `reflog exists` | reviewed-scope | partial | yes |  | Reference/OID syntax and repository resolution, expiry-date callbacks, root dispatch, configuration/version behavior and abbreviations. |
| `reflog expire` | reviewed-scope | partial | yes |  | Reference/OID syntax and repository resolution, expiry-date callbacks, root dispatch, configuration/version behavior and abbreviations. |
| `reflog list` | reviewed-scope | partial | yes |  | Reference/OID syntax and repository resolution, expiry-date callbacks, root dispatch, configuration/version behavior and abbreviations. |
| `reflog show` | reviewed-scope | partial | yes |  | Inherited multi-pass revision/diff callback grammars, repository/configuration conditions, end markers, shorthand and binary output; stash list conditional delegation remains separate. |
| `reflog write` | reviewed-scope | partial | yes |  | Reference/OID syntax and repository resolution, expiry-date callbacks, root dispatch, configuration/version behavior and abbreviations. |
| `refs` | documented | pending | pending |  | Audit every applicable facet. |
| `refs exists` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `refs list` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `refs migrate` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `refs optimize` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `refs verify` | reviewed-scope | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `remote` | documented | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `remote add` | reviewed-scope | partial | yes | remoteAdd | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `remote get-url` | reviewed-scope | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `remote prune` | reviewed-scope | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `remote remove` | reviewed-scope | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `remote rename` | reviewed-scope | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `remote rm` | reviewed-scope | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `remote set-branches` | reviewed-scope | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `remote set-head` | reviewed-scope | partial | yes | remoteSetHead | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `remote set-url` | reviewed-scope | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `remote show` | reviewed-scope | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `remote update` | reviewed-scope | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `remote-ext` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `remote-fd` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `repack` | documented | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `replace` | documented | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `replay` | documented | pending | pending |  | Audit every applicable facet. |
| `repo` | documented | pending | pending |  | Audit every applicable facet. |
| `request-pull` | documented | pending | pending |  | Audit every applicable facet. |
| `rerere` | documented | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `rerere clear` | reviewed-scope | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `rerere diff` | reviewed-scope | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `rerere forget` | reviewed-scope | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `rerere gc` | reviewed-scope | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `rerere remaining` | reviewed-scope | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `rerere status` | reviewed-scope | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `reset` | documented | partial | yes | reset | Revision/path disambiguation before --, pathspec file contents, repository state, numeric lexical forms and abbreviations. |
| `restore` | documented | partial | yes | restore | Pathspec file contents, repository/index state, sparse checkout, callback grammars and abbreviations. |
| `rev-list` | documented | pending | pending |  | Audit every applicable facet. |
| `rev-parse` | documented | pending | pending |  | Audit every applicable facet. |
| `revert` | documented | partial | yes | revert | Revision/object resolution, multipass ordering, configuration-driven sequencer state, callback grammars and revision shorthand. |
| `rm` | documented | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `scalar` | companion | pending | pending |  | Audit every applicable facet. |
| `send-email` | documented | pending | pending |  | Audit every applicable facet. |
| `send-pack` | documented | pending | pending |  | Audit every applicable facet. |
| `sh-i18n` | documented | pending | pending |  | Audit every applicable facet. |
| `sh-setup` | documented | pending | pending |  | Audit every applicable facet. |
| `shell` | documented | pending | pending |  | Audit every applicable facet. |
| `shortlog` | documented | pending | pending |  | Audit every applicable facet. |
| `show` | documented | partial | yes |  | Revision/object/path resolution, numeric shorthand, --end-of-options and command-specific multi-pass parsing; configuration-dependent defaults, callback languages, implicit no-index dispatch, follow/pathspec conditions and binary output. Git 2.55.0 oldest traversal crashes for a negative final count; recorded separately from argument rejection. |
| `show-branch` | documented | pending | pending |  | Audit every applicable facet. |
| `show-index` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `show-ref` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `sparse-checkout` | documented | pending | pending |  | Audit every applicable facet. |
| `stage` | documented | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `stash` | documented | pending | pending |  | Audit every applicable facet. |
| `stash apply` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash branch` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash clear` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash create` | reviewed-scope | partial | yes |  | Stash topology and working/index state; message behavior with non-ASCII and arbitrary control characters; independent cross-platform witnesses. |
| `stash drop` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash export` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash import` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash pop` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash push` | reviewed-scope | partial | yes | stashPush | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash save` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash show` | reviewed-scope | partial | yes |  | Inherited multi-pass revision/diff callback grammars, repository/configuration conditions, end markers, shorthand and binary output; stash list conditional delegation remains separate. |
| `stash store` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `status` | documented | partial | yes | status | Callback grammars, configuration-dependent defaults, abbreviations and independent coverage of all output values. |
| `stripspace` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `submodule` | documented | pending | pending |  | Audit every applicable facet. |
| `submodule update` | reviewed-scope | partial | pending | submoduleUpdate | require-init, numeric options and complete CLI surface. |
| `submodule--helper` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `svn` | documented | pending | pending |  | Audit every applicable facet. |
| `switch` | documented | partial | yes | switch | Repository-dependent tracking/DWIM, in-progress operations, object names, abbreviations and scalar callback grammars. |
| `symbolic-ref` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `tag` | documented | partial | yes | tagCreate | Column and formatting callback grammars, implicit listing with -n=-1, signing configuration, object names and abbreviations. |
| `unpack-file` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `unpack-objects` | documented | pending | pending |  | Audit every applicable facet. |
| `update-index` | documented | pending | pending |  | Audit every applicable facet. |
| `update-ref` | documented | partial | yes |  | Repository and index state, object/path validity, merge-strategy and recursion callbacks, numeric lexical forms, binary and stdin protocols, abbreviations and witnesses for every rule. |
| `update-server-info` | documented | partial | yes |  | Repository, configuration, object and ref state; delegated callback value grammars, numeric lexical forms, abbreviations and independent witnesses for every rule. This entry is not a completeness claim. |
| `upload-archive` | documented | pending | pending |  | Audit every applicable facet. |
| `upload-archive--writer` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `upload-pack` | documented | pending | pending |  | Audit every applicable facet. |
| `url-parse` | documented | pending | pending |  | Audit every applicable facet. |
| `var` | documented | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `verify-commit` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `verify-pack` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `verify-tag` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
| `version` | documented | partial | yes |  | Repository/configuration state, delegated scalar/filter/format grammars, numeric lexical forms, abbreviations, binary/stdin protocols and independent witnesses for every rule. |
| `whatchanged` | documented | pending | pending |  | Audit every applicable facet. |
| `worktree` | documented | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `worktree add` | reviewed-scope | partial | yes | worktreeAdd | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `worktree list` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `worktree lock` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `worktree move` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `worktree prune` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `worktree remove` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `worktree repair` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `worktree unlock` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `write-tree` | documented | partial | yes |  | Ref/object/path and callback value languages, configuration/repository conditions, binary stdin/output, abbreviated spellings and version differences. Native ignored operands are deliberately retained; conditional delegated parsers require further audit. |
