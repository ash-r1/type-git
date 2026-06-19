---
"type-git": patch
---

Add common Git transport configuration variables to the default environment allowlist

Following the environment variable traversal prevention change, Git's own SSH transport and TLS configuration variables were no longer inherited by default, which could break workflows relying on them (e.g. a custom SSH command).

The default allowlist now also inherits these Git configuration variables, which are commonly needed for transport configuration: `GIT_SSH`, `GIT_SSH_COMMAND`, `GIT_SSH_VARIANT`, `GIT_SSL_CAINFO`, `GIT_SSL_CAPATH`, `GIT_TERMINAL_PROMPT`, and `GIT_CONFIG_NOSYSTEM`. These are configuration rather than application secrets (though, depending on local setup, values such as `GIT_SSH_COMMAND` may name a command Git executes).

Credential-carrying / askpass variables — `GIT_ASKPASS`, `SSH_ASKPASS`, and `GIT_PROXY_COMMAND` — are intentionally **not** inherited by default, since they can carry inline credentials or invoke a helper that reads secrets from the environment. Opt into those (and any other variables) explicitly via `inheritEnv` when needed.
