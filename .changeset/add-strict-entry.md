---
"type-git": minor
---

Add the `type-git/strict` entry point. `strict()` wraps a `Git` client, `TypeGit`, worktree repository or bare repository and returns a view with every original member plus the grammar-checked `command()`. Its implementation now lives in this entry point (`CliRunner.runCommand()` and the existing `command()` methods delegate to it). `type-git/strict` also exports `GitCommandArgument`, `GitCommandClient`, `GitCommandExecOpts`, `GitCommandName`, `CheckedCommandArguments`, `Strict<T>`, `StrictGit`, `StrictWorktreeRepo` and `StrictBareRepo`, and the main entry point now exports `CompanionExecutable`.
