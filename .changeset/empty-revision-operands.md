---
"type-git": patch
---

Convenience APIs no longer drop an empty revision or commit message. Previously an empty string was treated as omitted, so `repo.reset('')` ran `git reset` and unstaged changes, `repo.rebase({ upstream: '' })` rebased onto the configured upstream, and `repo.restore(path, { source: '' })` restored from the index, although Git rejects each of these words in every repository. `reset`, `diff`, `log` (`ref`), `rebase` (`upstream`, `onto`), `restore` (`source`), path `checkout` (`source`), `checkout`/`switch`/`branch.create` (`startPoint`) and `commit` (`fixup`, `squash`, `reuseMessage`, `file`) now refuse an empty value with `GitArgumentError` before running Git. `repo.commit({ message: '' })` now passes `-m ''`, so `allowEmptyMessage: true` creates a commit with an empty message instead of opening an editor, and without it Git reports the empty message.
