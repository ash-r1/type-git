# Diff color callback reachability

Git color parsing accepts the case-insensitive `always`, `auto`, and `never` names; a bare `--color` selects `always`. Empty strings and boolean spellings are not color modes. The existing shared color option definition can represent this callback without narrowing ignored tails.

The parser ordering matters. `diff`, `diff-files`, `diff-index`, `diff-tree`, and `rev-list` still evaluate reached color callbacks after short help. `diff --no-index`, `range-diff`, and `diff-pairs` stop local usage parsing before later options. `backfill`, `last-modified`, and `replay` process an initial parse-options help exit before retained revision callbacks, including an invalid color option that appeared earlier. Their retained option groups must carry the same color metadata. Their initial parse-options definitions also include `--help-all`, which exits before retained callbacks in either token order.

Multiword `--help-all` is not an early revision-parser exit for the continuing commands. Existing sole-full-help restrictions remain in place; an accepted color value does not make that surrounding invocation valid. The native comparison fixtures assert rejection for these combinations instead of treating every nonzero native status as an accepted usage shape.

For single-word commands, Git rewrites a first `--help` to documentation dispatch in `git.c`. The new local usage metadata excludes that first spelling. An internal `--help` can still select local usage. `usageExit` preserves ordinary dynamic argument vocabulary instead of widening every enum through `parserExit`.

Invalid reached literal option values retain an invalid parser-state sentinel, so distributing a possible color flag together with a valid string-taking flag cannot silently discard the rejected branch. Deferred parser error states retain their own handling. This generic change requires full contract validation before publication.

Native evidence was collected across Git 2.25.1, 2.47.3, 2.55.0, and 2.56.0 for available builtins. The finite matrices cover short help and full help, callback placement, accepted modes, and rejected values. They do not establish every abbreviation, configuration, platform, or rendering outcome. The ambiguous `--color` names in blame, annotate, and pickaxe are handled separately.

Validation results are recorded separately against the actual source state; only completed checks count as evidence. All command audits remain partial.
