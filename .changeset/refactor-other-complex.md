---
"type-git": patch
---

refactor: reduce cognitive complexity in remoteList, clone, and progress handling

- Extract `parseRemoteLine`, `updateRemoteUrl`, `normalizeRemoteUrls` helpers for `remoteList`
- Move regex patterns to top-level constants
- Create `buildCloneArgs` helper using Options Map pattern for `clone` method
- Extract `toLfsProgress`, `toGitProgress`, `processProgressLine` helpers for stderr progress handling
- Reduces code duplication and improves maintainability
