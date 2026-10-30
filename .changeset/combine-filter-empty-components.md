---
"type-git": patch
---

Match the selected Git's handling of empty `+`-separated components in `combine:` object filters. Git 2.54 and later skip them, while older Git rejects them with `invalid filter-spec`; when a filter contains an empty component, a read-only clone help probe now selects the executable's behavior for both typed commands and convenience clone/fetch/submodule validation.
