---
"type-git": minor
---

Add deny-list and predicate forms to `inheritEnv`

`inheritEnv` previously only accepted `true` / `false` / `string[]`, so the
default allowlist could be extended but never trimmed — dropping a single
default entry (e.g. `SSH_AUTH_SOCK` for an HTTPS-only app) meant rebuilding the
whole list by hand.

Two new forms are now supported:

- `{ add?: string[]; remove?: string[] }` — start from the default allowlist,
  add `add`, then subtract `remove` (`remove` wins on conflicts). For example
  `inheritEnv: { remove: ['SSH_AUTH_SOCK', 'SSH_AGENT_PID'] }`.
- `(name: string) => boolean` — a predicate that decides each variable
  individually, bypassing the default allowlist entirely.

`DEFAULT_ENV_ALLOWLIST` documentation now also calls out that `SSH_AUTH_SOCK` /
`SSH_AGENT_PID` are included by default (and how to drop them), while the more
dangerous `GIT_SSH_COMMAND` / `SSH_ASKPASS` / `GIT_ASKPASS` are intentionally
excluded.
