---
"type-git": minor
---

Add the `type-git/strict` entry point. `strict()` wraps a `Git` client, `TypeGit`, worktree repository or bare repository and returns a view with every original member plus the grammar-checked `command()`. The grammar-checked implementation now lives in this entry point; the `command()` methods on `Git`, `WorktreeRepo`, `BareRepo` and `TypeGit` and `CliRunner.runCommand()` are removed (see below). `type-git/strict` also exports `GitCommandArgument`, `GitCommandClient`, `GitCommandExecOpts`, `GitCommandName`, `CheckedCommandArguments`, `Strict<T>`, `StrictGit`, `StrictWorktreeRepo` and `StrictBareRepo`, and the main entry point now exports `CompanionExecutable`.
