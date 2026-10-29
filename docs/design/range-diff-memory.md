# Range-diff maximum memory values

Git 2.55.0 `builtin/range-diff.c:parse_max_memory` calls
`parse.c:git_parse_unsigned` with `SIZE_MAX`, then stores the result in
`size_t`. The option uses the existing unsigned configuration-integer
model: base-zero digits, optional `k`/`m`/`g` suffixes, full consumption,
uintmax overflow checks, and the selected size_t limit. Minus signs are
rejected. Binary prefixes depend on the selected native implementation.

The wrapper retains the original argument text and does not predict
memory allocation or range comparison results. Strings such as `1k` and
`0x10` remain valid, as does the full unsigned 64-bit maximum on the
64-bit size_t profile. A 32-bit size_t profile rejects `4294967296`.

The source callback returns immediately on unset. `--no-max-memory` is
therefore a valueless no-op: it does not reset an earlier value. The
generator binds that behavior by source file and callback identity and
keeps its generic integer-metadata override guard intact.

Reached internal help exits before later callbacks. Earlier invalid
memory values still fail before a later help flag or valid occurrence.
Top-level first `--help` retains Git's documentation dispatch. Independent
tuple shape and NUL checks are not bypassed by help.

The baseline compared 264 native/public invocations across six Git
versions with repository snapshots unchanged. Git 2.25/2.39/2.43/2.47 do
not register this option; those unknown-option results are distinct from
callback rejection on Git 2.55/2.56. Ten negative public type assertions
were initially unused. These finite controls leave the overall command
audit partial.
