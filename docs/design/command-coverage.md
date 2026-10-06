# Upstream command coverage

Baseline: Git 2.55.0; Git LFS 3.8.0.

Version-pinned upstream commands, registered aliases/helpers, and companion programs. Site-installed git-* extensions cannot be enumerated globally.

**Inventory is not implementation coverage.** Entries without an audit record are pending. A finite model count is not proof that upstream constraints were fully discovered.

Inventory contains 221 entries; the table also includes individually reviewed operation scopes. Candidate nested dispatch names are retained in the JSON inventory, not counted as audited operations.

| Command / operation | Classification | Audit | Typed CLI | Models | Remaining work |
| --- | --- | --- | --- | --- | --- |
| `add` | documented | partial | yes | add | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `am` | documented | pending | pending |  | Audit every applicable facet. |
| `annotate` | documented | pending | pending |  | Audit every applicable facet. |
| `apply` | documented | pending | pending |  | Audit every applicable facet. |
| `archimport` | documented | pending | pending |  | Audit every applicable facet. |
| `archive` | documented | pending | pending |  | Audit every applicable facet. |
| `backfill` | documented | pending | pending |  | Audit every applicable facet. |
| `bisect` | documented | pending | pending |  | Audit every applicable facet. |
| `blame` | documented | pending | pending |  | Audit every applicable facet. |
| `branch` | documented | partial | yes |  | Column callback grammar; object/filter value grammars; repository-dependent tracking and recursion; abbreviations and option clustering. |
| `bugreport` | documented | pending | pending |  | Audit every applicable facet. |
| `bundle` | documented | pending | pending |  | Audit every applicable facet. |
| `cat-file` | documented | pending | pending |  | Audit every applicable facet. |
| `check-attr` | documented | pending | pending |  | Audit every applicable facet. |
| `check-ignore` | documented | pending | pending |  | Audit every applicable facet. |
| `check-mailmap` | documented | pending | pending |  | Audit every applicable facet. |
| `check-ref-format` | documented | pending | pending |  | Audit every applicable facet. |
| `checkout` | documented | partial | yes | checkoutBranch, checkoutPath | Repository-dependent revision/path disambiguation and DWIM tracking; remaining path/branch-mode guards; callback grammars and abbreviations. |
| `checkout--worker` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `checkout-index` | documented | pending | pending |  | Audit every applicable facet. |
| `cherry` | documented | pending | pending |  | Audit every applicable facet. |
| `cherry-pick` | documented | partial | pending | cherryPick | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `citool` | documented | pending | pending |  | Audit every applicable facet. |
| `clean` | documented | partial | yes | clean | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `clone` | documented | partial | yes | clone | Depth and transport value grammars, repository/configuration conditions, abbreviations, transport-specific callbacks. |
| `column` | documented | pending | pending |  | Audit every applicable facet. |
| `commit` | documented | partial | yes | commit | Cleanup/fixup value grammars, repository-dependent author/content modes, callbacks and abbreviations. |
| `commit-graph` | documented | pending | pending |  | Audit every applicable facet. |
| `commit-tree` | documented | pending | pending |  | Audit every applicable facet. |
| `config` | documented | pending | pending |  | Audit every applicable facet. |
| `config get` | reviewed-scope | partial | pending | configGet | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `config list` | reviewed-scope | partial | pending | configList | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `count-objects` | documented | pending | pending |  | Audit every applicable facet. |
| `credential` | documented | pending | pending |  | Audit every applicable facet. |
| `credential-cache` | documented | pending | pending |  | Audit every applicable facet. |
| `credential-cache--daemon` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `credential-store` | documented | pending | pending |  | Audit every applicable facet. |
| `cvsexportcommit` | documented | pending | pending |  | Audit every applicable facet. |
| `cvsimport` | documented | pending | pending |  | Audit every applicable facet. |
| `cvsserver` | documented | pending | pending |  | Audit every applicable facet. |
| `daemon` | documented | pending | pending |  | Audit every applicable facet. |
| `describe` | documented | pending | pending |  | Audit every applicable facet. |
| `diagnose` | documented | pending | pending |  | Audit every applicable facet. |
| `diff` | documented | partial | pending | diff | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `diff-files` | documented | pending | pending |  | Audit every applicable facet. |
| `diff-index` | documented | pending | pending |  | Audit every applicable facet. |
| `diff-pairs` | documented | pending | pending |  | Audit every applicable facet. |
| `diff-tree` | documented | pending | pending |  | Audit every applicable facet. |
| `difftool` | documented | pending | pending |  | Audit every applicable facet. |
| `fast-export` | documented | pending | pending |  | Audit every applicable facet. |
| `fast-import` | documented | pending | pending |  | Audit every applicable facet. |
| `fetch` | documented | partial | yes | fetch | Remote groups and repository-dependent multiple mode, transport negotiation, callback value grammars and abbreviations. |
| `fetch-pack` | documented | pending | pending |  | Audit every applicable facet. |
| `filter-branch` | documented | pending | pending |  | Audit every applicable facet. |
| `fmt-merge-msg` | documented | pending | pending |  | Audit every applicable facet. |
| `for-each-ref` | documented | pending | pending |  | Audit every applicable facet. |
| `for-each-repo` | documented | pending | pending |  | Audit every applicable facet. |
| `format-patch` | documented | pending | pending |  | Audit every applicable facet. |
| `format-rev` | documented | pending | pending |  | Audit every applicable facet. |
| `fsck` | documented | pending | pending |  | Audit every applicable facet. |
| `fsck-objects` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `fsmonitor--daemon` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `gc` | documented | pending | pending |  | Audit every applicable facet. |
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
| `log` | documented | partial | pending | log | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `ls-files` | documented | pending | pending |  | Audit every applicable facet. |
| `ls-remote` | documented | partial | pending | lsRemote | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `ls-tree` | documented | partial | pending | lsTree | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `mailinfo` | documented | pending | pending |  | Audit every applicable facet. |
| `mailsplit` | documented | pending | pending |  | Audit every applicable facet. |
| `maintenance` | documented | pending | pending |  | Audit every applicable facet. |
| `merge` | documented | partial | pending | merge | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `merge-base` | documented | pending | pending |  | Audit every applicable facet. |
| `merge-file` | documented | pending | pending |  | Audit every applicable facet. |
| `merge-index` | documented | pending | pending |  | Audit every applicable facet. |
| `merge-one-file` | documented | pending | pending |  | Audit every applicable facet. |
| `merge-ours` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `merge-recursive` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `merge-recursive-ours` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `merge-recursive-theirs` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `merge-subtree` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `merge-tree` | documented | pending | pending |  | Audit every applicable facet. |
| `mergetool` | documented | pending | pending |  | Audit every applicable facet. |
| `mktag` | documented | pending | pending |  | Audit every applicable facet. |
| `mktree` | documented | pending | pending |  | Audit every applicable facet. |
| `multi-pack-index` | documented | pending | pending |  | Audit every applicable facet. |
| `mv` | documented | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `name-rev` | documented | pending | pending |  | Audit every applicable facet. |
| `notes` | documented | pending | pending |  | Audit every applicable facet. |
| `p4` | documented | pending | pending |  | Audit every applicable facet. |
| `pack-objects` | documented | pending | pending |  | Audit every applicable facet. |
| `pack-redundant` | documented | pending | pending |  | Audit every applicable facet. |
| `pack-refs` | documented | pending | pending |  | Audit every applicable facet. |
| `patch-id` | documented | pending | pending |  | Audit every applicable facet. |
| `pickaxe` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `prune` | documented | pending | pending |  | Audit every applicable facet. |
| `prune-packed` | documented | pending | pending |  | Audit every applicable facet. |
| `pull` | documented | partial | pending | pull | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `push` | documented | partial | yes | push | Remote/refspec resolution, protocol negotiation, push-option value grammar, callback grammars and abbreviations. |
| `quiltimport` | documented | pending | pending |  | Audit every applicable facet. |
| `range-diff` | documented | pending | pending |  | Audit every applicable facet. |
| `read-tree` | documented | pending | pending |  | Audit every applicable facet. |
| `rebase` | documented | partial | pending | rebase | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `receive-pack` | documented | pending | pending |  | Audit every applicable facet. |
| `reflog` | documented | pending | pending |  | Audit every applicable facet. |
| `refs` | documented | pending | pending |  | Audit every applicable facet. |
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
| `repack` | documented | pending | pending |  | Audit every applicable facet. |
| `replace` | documented | pending | pending |  | Audit every applicable facet. |
| `replay` | documented | pending | pending |  | Audit every applicable facet. |
| `repo` | documented | pending | pending |  | Audit every applicable facet. |
| `request-pull` | documented | pending | pending |  | Audit every applicable facet. |
| `rerere` | documented | pending | pending |  | Audit every applicable facet. |
| `reset` | documented | partial | yes | reset | Revision/path disambiguation before --, pathspec file contents, repository state, numeric lexical forms and abbreviations. |
| `restore` | documented | partial | yes | restore | Pathspec file contents, repository/index state, sparse checkout, callback grammars and abbreviations. |
| `rev-list` | documented | pending | pending |  | Audit every applicable facet. |
| `rev-parse` | documented | pending | pending |  | Audit every applicable facet. |
| `revert` | documented | partial | pending | revert | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `rm` | documented | partial | yes |  | Complete callback value grammars, aliases/abbreviations, repository/configuration-dependent behavior, and per-scope independent/compiler witnesses. |
| `scalar` | companion | pending | pending |  | Audit every applicable facet. |
| `send-email` | documented | pending | pending |  | Audit every applicable facet. |
| `send-pack` | documented | pending | pending |  | Audit every applicable facet. |
| `sh-i18n` | documented | pending | pending |  | Audit every applicable facet. |
| `sh-setup` | documented | pending | pending |  | Audit every applicable facet. |
| `shell` | documented | pending | pending |  | Audit every applicable facet. |
| `shortlog` | documented | pending | pending |  | Audit every applicable facet. |
| `show` | documented | pending | pending |  | Audit every applicable facet. |
| `show-branch` | documented | pending | pending |  | Audit every applicable facet. |
| `show-index` | documented | pending | pending |  | Audit every applicable facet. |
| `show-ref` | documented | pending | pending |  | Audit every applicable facet. |
| `sparse-checkout` | documented | pending | pending |  | Audit every applicable facet. |
| `stage` | documented | pending | pending |  | Audit every applicable facet. |
| `stash` | documented | pending | pending |  | Audit every applicable facet. |
| `stash apply` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash branch` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash clear` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash drop` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash export` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash import` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash pop` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash push` | reviewed-scope | partial | yes | stashPush | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash save` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `stash store` | reviewed-scope | partial | yes |  | Repository/configuration and object-state conditions; callback value grammars, abbreviations, and independent witnesses for every rule. Shared revision/diff parser coverage remains separate. |
| `status` | documented | partial | yes | status | Callback grammars, configuration-dependent defaults, abbreviations and independent coverage of all output values. |
| `stripspace` | documented | pending | pending |  | Audit every applicable facet. |
| `submodule` | documented | pending | pending |  | Audit every applicable facet. |
| `submodule update` | reviewed-scope | partial | pending | submoduleUpdate | require-init, numeric options and complete CLI surface. |
| `submodule--helper` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `svn` | documented | pending | pending |  | Audit every applicable facet. |
| `switch` | documented | partial | yes | switch | Repository-dependent tracking/DWIM, in-progress operations, object names, abbreviations and scalar callback grammars. |
| `symbolic-ref` | documented | pending | pending |  | Audit every applicable facet. |
| `tag` | documented | partial | yes | tagCreate | Column and formatting callback grammars, implicit listing with -n=-1, signing configuration, object names and abbreviations. |
| `unpack-file` | documented | pending | pending |  | Audit every applicable facet. |
| `unpack-objects` | documented | pending | pending |  | Audit every applicable facet. |
| `update-index` | documented | pending | pending |  | Audit every applicable facet. |
| `update-ref` | documented | pending | pending |  | Audit every applicable facet. |
| `update-server-info` | documented | pending | pending |  | Audit every applicable facet. |
| `upload-archive` | documented | pending | pending |  | Audit every applicable facet. |
| `upload-archive--writer` | builtin-undocumented | pending | pending |  | Audit every applicable facet. |
| `upload-pack` | documented | pending | pending |  | Audit every applicable facet. |
| `url-parse` | documented | pending | pending |  | Audit every applicable facet. |
| `var` | documented | pending | pending |  | Audit every applicable facet. |
| `verify-commit` | documented | pending | pending |  | Audit every applicable facet. |
| `verify-pack` | documented | pending | pending |  | Audit every applicable facet. |
| `verify-tag` | documented | pending | pending |  | Audit every applicable facet. |
| `version` | documented | pending | pending |  | Audit every applicable facet. |
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
| `write-tree` | documented | pending | pending |  | Audit every applicable facet. |
