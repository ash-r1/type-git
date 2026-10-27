# diff-tree sole full usage

A canonical sole `[["--help-all"]]` reaches the selected native Git executable. Git 2.55 calls `show_usage_if_asked` before revision parsing; older Git reaches ordinary usage rejection. Exit status and both streams remain native behavior, including repository setup failures outside a repository.

The full-help tuple requires exactly one argument word. No parser-exit metadata or final-rule exemption is needed. Multiword full-help, tagged dash operands, values attached to flags, invalid callbacks, NUL words, and the existing stdin/merge-base exclusion retain their validation boundaries. Dynamic public argument arrays retain the existing word-diff enumeration.

The finite native audit covers twelve shapes on four Linux Git versions inside and outside a repository, with all fixture file hashes unchanged. It uses two real commits plus separate uncommitted worktree content. Tests pin the latest commit id, changed-file names from single-commit and two-commit forms, committed patch contents that exclude unstaged worktree content, and native exit code 1. Outside controls include directories nested beneath a repository with a parent ceiling preventing discovery.

The executable-selection fixture uses an explicit real Git path on native expectations and public clients while PATH Git is shadowed by Node. It skips non-executable candidates and exercises quoted Windows PATH entries. Every native comparison test has an explicit 120-second timeout. Linux checks do not execute the Windows branch; remote Windows CI is required. Broad diff behavior, stdin streams, unmerged indexes, merge-base interactions, submodules, configuration interactions, and general quoted PATH grammar remain outside this finite check. All 430 audit scopes remain partial.
