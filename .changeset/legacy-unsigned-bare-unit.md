---
"type-git": patch
---

Accept a bare unit suffix (`k`, `m`, `g`, case-insensitive) as zero for unsigned magnitude values under the older strtoumax profile selected for Git 2.25, matching `git_parse_unsigned`, which lacks the `end == value` check there. Object filters such as `--filter=blob:limit=k` or `tree:G` and unsigned-long magnitude options such as `pack-objects --max-pack-size=g` are no longer rejected before execution on that profile, both at runtime and in the type-level grammar; such values also now trigger the selected executable's sign-policy probe.
