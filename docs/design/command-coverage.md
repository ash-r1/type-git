# Upstream command coverage

Baseline: Git 2.55.0; Git LFS 3.8.0.

Version-pinned upstream commands, registered aliases/helpers, and companion programs. Site-installed git-* extensions cannot be enumerated globally.

**Inventory is not implementation coverage.** Entries without an audit record are pending. A finite model count is not proof that upstream constraints were fully discovered.

Inventory contains 221 entries; the table also includes individually reviewed operation scopes. Candidate nested dispatch names are retained in the JSON inventory, not counted as audited operations.

| Command / operation | Classification | Audit | Models | Remaining work |
| --- | --- | --- | --- | --- |
| `add` | documented | partial | add | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `am` | documented | pending |  | Audit every applicable facet. |
| `annotate` | documented | pending |  | Audit every applicable facet. |
| `apply` | documented | pending |  | Audit every applicable facet. |
| `archimport` | documented | pending |  | Audit every applicable facet. |
| `archive` | documented | pending |  | Audit every applicable facet. |
| `backfill` | documented | pending |  | Audit every applicable facet. |
| `bisect` | documented | pending |  | Audit every applicable facet. |
| `blame` | documented | pending |  | Audit every applicable facet. |
| `branch` | documented | pending |  | Audit every applicable facet. |
| `bugreport` | documented | pending |  | Audit every applicable facet. |
| `bundle` | documented | pending |  | Audit every applicable facet. |
| `cat-file` | documented | pending |  | Audit every applicable facet. |
| `check-attr` | documented | pending |  | Audit every applicable facet. |
| `check-ignore` | documented | pending |  | Audit every applicable facet. |
| `check-mailmap` | documented | pending |  | Audit every applicable facet. |
| `check-ref-format` | documented | pending |  | Audit every applicable facet. |
| `checkout` | documented | partial | checkoutBranch, checkoutPath | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `checkout--worker` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `checkout-index` | documented | pending |  | Audit every applicable facet. |
| `cherry` | documented | pending |  | Audit every applicable facet. |
| `cherry-pick` | documented | partial | cherryPick | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `citool` | documented | pending |  | Audit every applicable facet. |
| `clean` | documented | partial | clean | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `clone` | documented | partial | clone | Transport/configuration conditions; options not exposed by CloneOpts. |
| `column` | documented | pending |  | Audit every applicable facet. |
| `commit` | documented | partial | commit | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `commit-graph` | documented | pending |  | Audit every applicable facet. |
| `commit-tree` | documented | pending |  | Audit every applicable facet. |
| `config` | documented | pending |  | Audit every applicable facet. |
| `config get` | reviewed-scope | partial | configGet | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `config list` | reviewed-scope | partial | configList | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `count-objects` | documented | pending |  | Audit every applicable facet. |
| `credential` | documented | pending |  | Audit every applicable facet. |
| `credential-cache` | documented | pending |  | Audit every applicable facet. |
| `credential-cache--daemon` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `credential-store` | documented | pending |  | Audit every applicable facet. |
| `cvsexportcommit` | documented | pending |  | Audit every applicable facet. |
| `cvsimport` | documented | pending |  | Audit every applicable facet. |
| `cvsserver` | documented | pending |  | Audit every applicable facet. |
| `daemon` | documented | pending |  | Audit every applicable facet. |
| `describe` | documented | pending |  | Audit every applicable facet. |
| `diagnose` | documented | pending |  | Audit every applicable facet. |
| `diff` | documented | partial | diff | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `diff-files` | documented | pending |  | Audit every applicable facet. |
| `diff-index` | documented | pending |  | Audit every applicable facet. |
| `diff-pairs` | documented | pending |  | Audit every applicable facet. |
| `diff-tree` | documented | pending |  | Audit every applicable facet. |
| `difftool` | documented | pending |  | Audit every applicable facet. |
| `fast-export` | documented | pending |  | Audit every applicable facet. |
| `fast-import` | documented | pending |  | Audit every applicable facet. |
| `fetch` | documented | partial | fetch | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `fetch-pack` | documented | pending |  | Audit every applicable facet. |
| `filter-branch` | documented | pending |  | Audit every applicable facet. |
| `fmt-merge-msg` | documented | pending |  | Audit every applicable facet. |
| `for-each-ref` | documented | pending |  | Audit every applicable facet. |
| `for-each-repo` | documented | pending |  | Audit every applicable facet. |
| `format-patch` | documented | pending |  | Audit every applicable facet. |
| `format-rev` | documented | pending |  | Audit every applicable facet. |
| `fsck` | documented | pending |  | Audit every applicable facet. |
| `fsck-objects` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `fsmonitor--daemon` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `gc` | documented | pending |  | Audit every applicable facet. |
| `get-tar-commit-id` | documented | pending |  | Audit every applicable facet. |
| `gitk` | companion | pending |  | Audit every applicable facet. |
| `gitweb` | companion | pending |  | Audit every applicable facet. |
| `grep` | documented | pending |  | Audit every applicable facet. |
| `gui` | documented | pending |  | Audit every applicable facet. |
| `hash-object` | documented | pending |  | Audit every applicable facet. |
| `help` | documented | pending |  | Audit every applicable facet. |
| `history` | documented | pending |  | Audit every applicable facet. |
| `hook` | documented | pending |  | Audit every applicable facet. |
| `http-backend` | documented | pending |  | Audit every applicable facet. |
| `http-fetch` | documented | pending |  | Audit every applicable facet. |
| `http-push` | documented | pending |  | Audit every applicable facet. |
| `imap-send` | documented | pending |  | Audit every applicable facet. |
| `index-pack` | documented | pending |  | Audit every applicable facet. |
| `init` | documented | partial | init | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `init-db` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `instaweb` | documented | pending |  | Audit every applicable facet. |
| `interpret-trailers` | documented | pending |  | Audit every applicable facet. |
| `last-modified` | documented | pending |  | Audit every applicable facet. |
| `lfs checkout` | lfs-registered | partial | lfsCheckout | Common command API including help and explicit false flag spelling. |
| `lfs clean` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs clone` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs completion` | lfs-dispatcher | pending |  | Audit every applicable facet. |
| `lfs dedup` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs env` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs ext` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs ext list` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs fetch` | lfs-registered | partial | lfsFetch | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `lfs filter-process` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs fsck` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs help` | lfs-dispatcher | pending |  | Audit every applicable facet. |
| `lfs install` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs install hooks` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs lock` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs locks` | lfs-registered | partial | lfsLocks | Non-cached server interactions and full scalar grammar. |
| `lfs logs` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs logs boomtown` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs logs clear` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs logs last` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs logs show` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs ls-files` | lfs-registered | partial | lfsLsFiles | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `lfs merge-driver` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs migrate` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs migrate export` | lfs-registered | partial | lfsMigrateExport | Full scalar value grammar and positional ref selection audit. |
| `lfs migrate import` | lfs-registered | partial | lfsMigrateImport | Scalar value grammar and independent LFS fixtures. |
| `lfs migrate info` | lfs-registered | partial | lfsMigrateInfo | Scalar value grammar and independent LFS fixtures. |
| `lfs pointer` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs post-checkout` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs post-commit` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs post-merge` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs pre-push` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs prune` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs pull` | lfs-registered | partial | lfsPull | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `lfs push` | lfs-registered | partial | lfsPush | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `lfs smudge` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs standalone-file` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs status` | lfs-registered | partial | lfsStatus | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `lfs track` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs uninstall` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs uninstall hooks` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs unlock` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs untrack` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs update` | lfs-registered | pending |  | Audit every applicable facet. |
| `lfs version` | lfs-registered | pending |  | Audit every applicable facet. |
| `log` | documented | partial | log | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `ls-files` | documented | pending |  | Audit every applicable facet. |
| `ls-remote` | documented | partial | lsRemote | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `ls-tree` | documented | partial | lsTree | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `mailinfo` | documented | pending |  | Audit every applicable facet. |
| `mailsplit` | documented | pending |  | Audit every applicable facet. |
| `maintenance` | documented | pending |  | Audit every applicable facet. |
| `merge` | documented | partial | merge | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `merge-base` | documented | pending |  | Audit every applicable facet. |
| `merge-file` | documented | pending |  | Audit every applicable facet. |
| `merge-index` | documented | pending |  | Audit every applicable facet. |
| `merge-one-file` | documented | pending |  | Audit every applicable facet. |
| `merge-ours` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `merge-recursive` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `merge-recursive-ours` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `merge-recursive-theirs` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `merge-subtree` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `merge-tree` | documented | pending |  | Audit every applicable facet. |
| `mergetool` | documented | pending |  | Audit every applicable facet. |
| `mktag` | documented | pending |  | Audit every applicable facet. |
| `mktree` | documented | pending |  | Audit every applicable facet. |
| `multi-pack-index` | documented | pending |  | Audit every applicable facet. |
| `mv` | documented | pending |  | Audit every applicable facet. |
| `name-rev` | documented | pending |  | Audit every applicable facet. |
| `notes` | documented | pending |  | Audit every applicable facet. |
| `p4` | documented | pending |  | Audit every applicable facet. |
| `pack-objects` | documented | pending |  | Audit every applicable facet. |
| `pack-redundant` | documented | pending |  | Audit every applicable facet. |
| `pack-refs` | documented | pending |  | Audit every applicable facet. |
| `patch-id` | documented | pending |  | Audit every applicable facet. |
| `pickaxe` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `prune` | documented | pending |  | Audit every applicable facet. |
| `prune-packed` | documented | pending |  | Audit every applicable facet. |
| `pull` | documented | partial | pull | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `push` | documented | partial | push | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `quiltimport` | documented | pending |  | Audit every applicable facet. |
| `range-diff` | documented | pending |  | Audit every applicable facet. |
| `read-tree` | documented | pending |  | Audit every applicable facet. |
| `rebase` | documented | partial | rebase | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `receive-pack` | documented | pending |  | Audit every applicable facet. |
| `reflog` | documented | pending |  | Audit every applicable facet. |
| `refs` | documented | pending |  | Audit every applicable facet. |
| `remote` | documented | pending |  | Audit every applicable facet. |
| `remote add` | reviewed-scope | partial | remoteAdd | Master branch selection and complete CLI surface. |
| `remote set-head` | reviewed-scope | partial | remoteSetHead | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `remote-ext` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `remote-fd` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `repack` | documented | pending |  | Audit every applicable facet. |
| `replace` | documented | pending |  | Audit every applicable facet. |
| `replay` | documented | pending |  | Audit every applicable facet. |
| `repo` | documented | pending |  | Audit every applicable facet. |
| `request-pull` | documented | pending |  | Audit every applicable facet. |
| `rerere` | documented | pending |  | Audit every applicable facet. |
| `reset` | documented | partial | reset | Patch input, positional paths, file content dependent pathspec checks, complete CLI surface. |
| `restore` | documented | partial | restore | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `rev-list` | documented | pending |  | Audit every applicable facet. |
| `rev-parse` | documented | pending |  | Audit every applicable facet. |
| `revert` | documented | partial | revert | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `rm` | documented | pending |  | Audit every applicable facet. |
| `scalar` | companion | pending |  | Audit every applicable facet. |
| `send-email` | documented | pending |  | Audit every applicable facet. |
| `send-pack` | documented | pending |  | Audit every applicable facet. |
| `sh-i18n` | documented | pending |  | Audit every applicable facet. |
| `sh-setup` | documented | pending |  | Audit every applicable facet. |
| `shell` | documented | pending |  | Audit every applicable facet. |
| `shortlog` | documented | pending |  | Audit every applicable facet. |
| `show` | documented | pending |  | Audit every applicable facet. |
| `show-branch` | documented | pending |  | Audit every applicable facet. |
| `show-index` | documented | pending |  | Audit every applicable facet. |
| `show-ref` | documented | pending |  | Audit every applicable facet. |
| `sparse-checkout` | documented | pending |  | Audit every applicable facet. |
| `stage` | documented | pending |  | Audit every applicable facet. |
| `stash` | documented | pending |  | Audit every applicable facet. |
| `stash push` | reviewed-scope | partial | stashPush | Patch mode and complete CLI surface. |
| `status` | documented | partial | status | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `stripspace` | documented | pending |  | Audit every applicable facet. |
| `submodule` | documented | pending |  | Audit every applicable facet. |
| `submodule update` | reviewed-scope | partial | submoduleUpdate | require-init, numeric options and complete CLI surface. |
| `submodule--helper` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `svn` | documented | pending |  | Audit every applicable facet. |
| `switch` | documented | partial | switch | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `symbolic-ref` | documented | pending |  | Audit every applicable facet. |
| `tag` | documented | partial | tagCreate | List/verify/delete modes and complete CLI surface. |
| `unpack-file` | documented | pending |  | Audit every applicable facet. |
| `unpack-objects` | documented | pending |  | Audit every applicable facet. |
| `update-index` | documented | pending |  | Audit every applicable facet. |
| `update-ref` | documented | pending |  | Audit every applicable facet. |
| `update-server-info` | documented | pending |  | Audit every applicable facet. |
| `upload-archive` | documented | pending |  | Audit every applicable facet. |
| `upload-archive--writer` | builtin-undocumented | pending |  | Audit every applicable facet. |
| `upload-pack` | documented | pending |  | Audit every applicable facet. |
| `url-parse` | documented | pending |  | Audit every applicable facet. |
| `var` | documented | pending |  | Audit every applicable facet. |
| `verify-commit` | documented | pending |  | Audit every applicable facet. |
| `verify-pack` | documented | pending |  | Audit every applicable facet. |
| `verify-tag` | documented | pending |  | Audit every applicable facet. |
| `version` | documented | pending |  | Audit every applicable facet. |
| `whatchanged` | documented | pending |  | Audit every applicable facet. |
| `worktree` | documented | pending |  | Audit every applicable facet. |
| `worktree add` | reviewed-scope | partial | worktreeAdd | Complete CLI surface, operand rules and independent per-command conformance fixtures. |
| `write-tree` | documented | pending |  | Audit every applicable facet. |
