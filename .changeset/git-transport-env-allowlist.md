---
"type-git": patch
---

Add common Git transport configuration variables to the default environment allowlist

Following the environment variable traversal prevention change, Git's own transport/TLS configuration variables were no longer inherited by default, which could break workflows relying on them (e.g. a custom SSH command).

The default allowlist now also inherits these non-secret Git configuration variables: `GIT_SSH`, `GIT_SSH_COMMAND`, `GIT_SSH_VARIANT`, `GIT_SSL_CAINFO`, `GIT_SSL_CAPATH`, `GIT_PROXY_COMMAND`, `GIT_ASKPASS`, `SSH_ASKPASS`, `GIT_TERMINAL_PROMPT`, and `GIT_CONFIG_NOSYSTEM`.

Application secrets remain excluded; use `inheritEnv` to opt any additional variables back in.
