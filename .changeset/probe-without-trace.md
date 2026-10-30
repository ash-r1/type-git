---
"type-git": patch
---

Run internal capability probes without tracing. When `audit.onTrace` was set (or `GIT_TRACE*` variables were configured), trace lines were mixed into probe stderr, so exact diagnostic matches failed and native-constraint validation (for example rejecting `depth: 2147483648` on 64-bit Git) was silently skipped. Probes now strip `GIT_TRACE`, `GIT_TRACE2*`, `GIT_TRACE_*` and `GIT_CURL_VERBOSE` from their environment and no longer emit events to `onAudit` / `onTrace`; the user's own command is still traced and audited as before.
