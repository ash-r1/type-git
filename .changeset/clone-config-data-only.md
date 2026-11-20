---
"type-git": minor
---

**Breaking:** `git.clone(url, path, { config })` now accepts only data-only config keys.

`git clone -c` applies the key to the initial fetch and writes it into the new repository, so keys such as `protocol.ext.allow` (with an `ext::` URL), `include.path`, `core.sshCommand` or `core.fsmonitor` let the caller's input run a program. The `config` option is now typed as `CloneConfig`, and both the type and a runtime check accept only keys that hold data: `user.*`, checkout and transfer settings such as `core.autocrlf` and `protocol.version`, `http.*` and `http.<url>.*` transport settings such as `extraHeader`, `proxy` and `sslVerify`, and the others listed in `CloneConfigSchema`. Keys that switch off Git's protections against a malicious repository (`core.protectNTFS`, `core.protectHFS`, `*.fsckObjects`) are not accepted either. At runtime, section and variable names match case-insensitively (ASCII only), as in Git; the `CloneConfig` type accepts only the spellings it declares, so in an object literal `core.autocrlf` type-checks and `CORE.AUTOCRLF` is rejected. Values must not contain NUL, CR or LF.

Any other key is refused with `GitArgumentError` before Git starts. Set it with `repo.config` after cloning, or pass a trusted value through `raw()` or strict `command()`. To clone without running the Git LFS smudge filter, use `git.raw(['clone', url, path], { env: { GIT_LFS_SKIP_SMUDGE: '1' } })`.
