# Selected ls-tree mode callbacks

Git 2.25 implements long/name-only/name-status as bits. Git 2.55 implements these as command modes and rejects incompatible combinations immediately. Both parse option lists with flags 0. Newer object-only and format options cannot be borrowed into the older bit-mode family.

The selected executable is observed with three help-ended pairs: long/name-only, name-only/long, and name-only/name-status. All three must either reach usage without a callback error or return the audited ordered mode-conflict diagnostics. Mixed, localized, outside-repository or other unknown results execute the original shape-validated argv. Every probe ends in internal help, consumes no caller stdin and preserves environment and abort signals. No version-number threshold is assumed.

Profiling applies to a reached old mode before help or an end marker, including calls without help. The runtime removes mutual exclusion only for the source-audited old bit options. Modern contexts retain immediate command-mode conflicts. A legacy complete state must still satisfy final rules, including the required tree operand, unless internal help has exited. Reached abbreviation callbacks remain active. Earlier help skips later callbacks and final checks. Newer-only options reached before help invalidate the legacy alternative.

Literal validation keeps a complete source family for each input. Each input tuple is checked before collecting failures across a union; invalid branches remain explicit failures rather than disappearing as never. Safe ordinary, legacy-combination and help unions are accepted within the same bit family. Explicit bits contexts retain valid non-help calls such as long output for HEAD, while modern pins retain their mode conflicts.

Known option catalogue, shape and NUL guards remain active after help. Required help-looking values, tagged operands and end markers do not create a help exit. First-word --help remains documentation dispatch. Sole completion words remain distinct from multiword unknown options; older unsupported words preserve native errors.

Finite four-Linux-Git controls cover help, completion, mode order, alias/repetition, ordinary tree listings and reached numeric or unsupported-format failures. Index, tracked file and HEAD-file bytes are checked unchanged in an isolated fixture. These controls do not establish complete tree/path payloads, repository configurations, concurrency or full platform/version grammar. All command audits remain partial.
