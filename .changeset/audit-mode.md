---
"type-git": minor
---

Add audit mode for command lifecycle tracking

New `audit` configuration option in `createGit()` provides hooks for observing Git command execution:

- `onAudit(event)`: Receives start/end events for every Git command
- `onTrace(trace)`: Receives GIT_TRACE output lines when enabled

Example usage:
```typescript
const git = await createGit({
  adapters: createNodeAdapters(),
  audit: {
    onAudit: (event) => {
      if (event.type === 'start') {
        console.log(`Starting: ${event.argv.join(' ')}`);
      } else {
        console.log(`Completed in ${event.duration}ms (exit ${event.exitCode})`);
      }
    },
    onTrace: (trace) => {
      console.log(`[GIT_TRACE] ${trace.line}`);
    }
  }
});
```

Types exported: `AuditEvent`, `AuditEventStart`, `AuditEventEnd`, `TraceEvent`, `AuditConfig`
