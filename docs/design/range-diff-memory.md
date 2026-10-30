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

The first full 294-fixture compiler run on the corrected feature reached
its unchanged 12288 MiB V8 heap limit. To reduce retained compiler graphs,
the generator shares 15 repeated readonly scalar-parser definitions
rather than emitting separate object literals for 930 parser locations.
The 428 catalogue values and bidirectional catalogue types remain equal.
Generated identifier names avoid existing string parser names. This does
not change parser algorithms, public option types, or validation scope.
A new standard whole-project run is required before claiming the capacity
change is sufficient.

Although the local full run passed after scalar-parser sharing, CI still
reached the standard heap limit. The generator therefore also shares
1,374 exact readonly option definitions across initial, argument, and
remaining-option dictionaries. All 428 catalogue values and bidirectional
types remain equal. Identifier allocation reserves existing property
names and string values; dedicated controls cover collisions, preserved
metadata, and distinct singleton definitions. The remote failure remains
recorded, and this additional capacity change requires fresh validation.

CI still reached the standard heap limit after option sharing. Profile
initialization now applies the same distinct ABI and callback fields with
one `Omit` instead of five to seven nested assignments. The original state
types remain bidirectionally assignable for all 428 commands and checked
union/never cases. The emitted JavaScript is unchanged. Focused compiler
measurements improved, but whole-project and remote CI results are separate
required checks; no memory-limit or fixture-scope change is made.
