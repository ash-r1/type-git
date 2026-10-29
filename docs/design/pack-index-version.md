# Pack index version values

`pack-objects` and `index-pack` accept a decimal version and an optional
comma followed by a base-zero offset limit. Both use `strtoul`, ignore
`errno`, and store each result in a `uint32_t` field before checking it.
The stored version must be at most 2; the offset's high bit must be clear.
Empty version text converts to zero. Leading C whitespace and signs are
accepted, while unconsumed suffixes are rejected.

These details preserve values such as `4294967296` on a 64-bit C-long
profile and `1,4294967296`, whose stored fields wrap to zero. A 32-bit
C-long profile saturates those conversions before storage and rejects
them. The existing selected-native unsigned overflow and binary-prefix
traits govern these conversions too. The public string remains unchanged
in argv; the model does not predict pack output or index contents.

The two entry points differ at an empty offset. The `pack-objects`
callback only consumes a comma when another character follows it, so
`1,` is invalid. The handwritten `index-pack` loop always consumes the
comma and converts the empty suffix to zero, so `1,` is valid there.
Both reject extra commas and invalid octal text such as `1,08`.

Earlier invalid values fail before a later `-h`; a reached `-h` exits
before later values. For `index-pack` this is the handwritten parser's
usage exit. Native Git owns its exit status and output. Independent NUL
and tuple-shape checks still apply even after a usage exit.

The baseline compared 600 native/public invocations across Git
2.25/2.39/2.43/2.47/2.55/2.56, with repository file snapshots unchanged.
It exposed native rejection of values the wrapper had forwarded, and
nine unused negative type assertions. These finite controls do not
complete either command's overall audit.
