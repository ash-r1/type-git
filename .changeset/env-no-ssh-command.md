---
"type-git": minor
---

**Breaking:** `GIT_SSH` and `GIT_SSH_COMMAND` are no longer inherited from the parent environment by default.

Both name a program that Git runs for every SSH fetch, push or ls-remote, so whoever controls the parent environment chose that command. They now follow the same rule as `GIT_ASKPASS`, `SSH_ASKPASS` and `GIT_PROXY_COMMAND`: no variable that names a program is in `DEFAULT_ENV_ALLOWLIST`. Opt back in with `inheritEnv: ['GIT_SSH_COMMAND']` (or `{ add: ['GIT_SSH_COMMAND'] }`), or pass the value through the `env` option. `GIT_SSH_VARIANT`, the SSH agent variables and the TLS settings are still inherited.
