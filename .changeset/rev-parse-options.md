---
"type-git": minor
---

Add rev-parse with comprehensive options support

- Add `revParse()` method to WorktreeRepo and BareRepo interfaces
- Support ref resolution options: `verify`, `short`, `abbrevRef`, `symbolic`, `symbolicFullName`, `quiet`
- Support path queries: `gitDir`, `absoluteGitDir`, `gitCommonDir`, `showToplevel`, `showCdup`, `showPrefix`, `showSuperprojectWorkingTree`, `sharedIndexPath`, `gitPath`, `resolveGitDir`
- Support boolean queries: `isInsideGitDir`, `isInsideWorkTree`, `isBareRepository`, `isShallowRepository`
- Support list queries: `all`, `branches`, `tags`, `remotes`, `glob`, `disambiguate` with `exclude` and `excludeHidden` options
- Support other queries: `showObjectFormat`, `showRefFormat`, `localEnvVars`
- Add `pathFormat` option for controlling absolute/relative path output
