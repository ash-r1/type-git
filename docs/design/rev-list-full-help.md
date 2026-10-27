# rev-list sole full usage

A canonical sole `[["--help-all"]]` now reaches the selected native Git executable. Git 2.55 invokes `show_usage_if_asked` before revision parsing; older Git reaches ordinary usage rejection. Exit status and both streams remain native behavior, including repository setup failures outside a repository.

The full-help tuple requires one argument word. Multiword full-help is not an exit from revision parsing, and no parser-exit metadata is added. Only the final input-required rule exempts this sole full-help shape; the flag’s one-word check still runs. All other rules and callback checks remain in place. Existing allowed-value enumerations stay narrow for dynamic public argument arrays; the type fixture checks `--disk-usage` explicitly. Tagged dash operands, flag values, earlier callback errors, and NUL words keep their validation boundaries.

The finite native audit uses twelve shapes, four Linux Git versions, and inside/outside contexts, checking every fixture file hash for mutation. Ordinary controls assert native success for a real HEAD, a maximum of one commit, count output, and object listing. Public tests pin the commit id, count `1`, and a tracked blob listing, and isolate outside directories nested beneath a repository with a parent ceiling. Tagged dash operand controls are representation boundaries, not all product regressions.

Broad traversal, filtering, stdin, bitmap, shallow/partial repositories, configuration, and platform parity remain outside this finite check. All 430 command audit scopes remain partial.

The executable-selection regression resolves the actual Git used for setup to an absolute path, shadows PATH’s `git` with a copy of the Node executable, and passes the real path through public `gitBinary` on both repository and outside clients. Native expectations use the same real path. The shadow command must produce a different status/output tuple, so accidentally using PATH’s executable cannot satisfy the help comparison. This is an executable-selection control, not a second native Git-version oracle.

Executable lookup also skips non-files and candidates without execute permission. A leading non-executable file on POSIX (a directory named `git.exe` on Windows) verifies that native PATH lookup and the explicit selector reach the same later Git executable. Unexpected filesystem errors are not suppressed.

On Windows the selector removes boundary single/double quotes from ordinary PATH entries before resolving a candidate, following [Node’s libuv search implementation](https://github.com/nodejs/node/blob/v20.x/deps/uv/src/win/process.c#L385-L413). The native executable-selection test quotes the Windows PATH entries explicitly; POSIX entries retain literal quotes. This Windows-specific execution must be verified in remote Windows CI; the Linux local run does not execute that branch. General quoted PATH grammar (including delimiters embedded within directory names) is not established by this fixture.
