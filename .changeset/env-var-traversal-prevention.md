---
"type-git": minor
---

Stop implicitly inheriting the full parent process environment (environment variable traversal prevention)

Previously, every spawned Git command inherited the entire parent process environment. This leaked secrets that happen to live in the parent process (cloud credentials, API tokens, etc.) into Git and any tools it shells out to — credential helpers, hooks, and LFS transfer agents — which is an environment variable traversal risk.

Now, only a curated allowlist of variables that Git genuinely needs to operate (e.g. `PATH`, `HOME`, locale, `SSH_AUTH_SOCK`, proxy settings, and Windows essentials) is inherited by default. Sensitive variables are no longer forwarded.

A new `inheritEnv` option controls this behavior on `createGit()`, `git.open()`/`openBare()`/`openRaw()`, and `CliRunner`:

- `undefined` (default): inherit only the built-in safe allowlist (`DEFAULT_ENV_ALLOWLIST`).
- `true`: inherit the entire parent environment (previous behavior, opt-in).
- `false`: inherit nothing beyond explicitly provided `env`.
- `string[]`: inherit the default allowlist plus the named variables.

```typescript
// Opt a specific variable back in
const git = await createGit({
  adapters: createNodeAdapters(),
  inheritEnv: ['MY_CUSTOM_VAR'],
});

// Restore the previous "inherit everything" behavior
const repo = await git.open('/path/to/repo', { inheritEnv: true });
```

**Breaking:** Workflows that relied on arbitrary parent environment variables reaching Git (for example a commit-signing or credential helper that reads a token from the environment) must now opt those variables back in via `inheritEnv`.

New exports: `EnvInheritance`, `DEFAULT_ENV_ALLOWLIST`, `resolveInheritedEnv`.
