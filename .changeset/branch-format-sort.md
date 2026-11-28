---
'type-git': patch
---

`git branch` now checks `--format` and `--sort` the same way Git 2.55.0 does in list mode (an explicit `--list`, a filter option such as `--merged`, or no action and no branch name). The checks apply in the strict API, and `repo.branch.list()` checks its `sort` option:

- A `--format` value needs a `)` after every `%(`. Each atom must be a ref-filter field name, optionally prefixed with `*`, and its argument must be one that field accepts. For example, `%(refname:short)`, `%(objectname:short=7)`, `%(align:10,left)` and `%(color:bold red)` are accepted, while `%(foo)`, `%(objectname:short=0)`, `%(color:bogus)` and `%(align)` are refused. `%(rest)` is refused.
- A `--sort` key is an optional `-`, an optional `version:` or `v:`, and a field with the same argument rules, such as `-committerdate` or `v:refname`.

Outside list mode Git ignores both options, so they are not checked. Some checks run only while Git prints or compares a ref, such as the `%(if)`/`%(then)`/`%(end)` structure and date formats like `%(authordate:bogus)`. Git also looks up the commit named by `%(ahead-behind:…)` or `%(is-base:…)`. These are left to Git. With these checks, the branch audit is complete.
