# Reusing command argument vocabularies

`LocalCommandArgumentsByName` gives each command a named entry for its option tuples, operands, separator, and numeric options. Indexing that table replaces repeated distributive expansion of the same vocabulary. The option definitions and public dispatch rules remain unchanged. A union of command names still admits each member's local vocabulary; `never` still has no vocabulary.

The public type fixture covers single commands, command unions, unknown options, cross-command options, and `never`. The standard complete contracts check still uses its existing 12,288 MiB heap limit and includes all contracts without filtering or sharding.

## Initial measurement

With Node.js 20.20.2 and TypeScript 5.9.3, the same selected public fixtures and non-test source files produced these extended diagnostics. The baseline is the recorded unpack-objects verification at the tree merged as `4bc67fa7cf97dbaa73bab55843ff19bad4d31553`; the candidate is the initial vocabulary-table experiment before the additional boundary fixture.

| Diagnostic | Baseline | Candidate |
| --- | ---: | ---: |
| Types | 1,239,994 | 1,016,867 |
| Instantiations | 9,524,544 | 4,566,489 |
| Check time | 91.16 s | 38.61 s |
| Total time | 92.41 s | 40.18 s |
| Memory used | 1,739,179 K | 2,088,888 K |

These are one-run observations, not a benchmark guarantee. Instantiation counts decreased, but the reported end-of-run memory snapshot increased. This does not establish lower peak memory or resolve the earlier CI heap failures. Full-contract verification and CI results must be recorded separately for the final commit.

This change does not complete any of the 430 command audit scopes.
