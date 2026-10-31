---
"type-git": patch
---

Reject remotes, URLs, refs, names, and paths that start with `-` in the convenience APIs before spawning Git. Such values were parsed as options, so `fetch({ remote: '--upload-pack=<cmd>' })`, `clone`, `pull`, `push`, and `lsRemote` could run arbitrary commands and `log`, `diff`, and `show` could write files through `--output`. These calls now throw `GitArgumentError`; pass a path that starts with `-` as `./-name`. `config.set`, `config.add`, and `config.setRaw` now place `--` before the key so values such as `-1` are stored literally.
