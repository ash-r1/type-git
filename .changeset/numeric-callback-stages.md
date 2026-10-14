---
"type-git": minor
---

Model Git numeric callback conversion stages separately from native integer handlers. Accept decimal strings and bigint for supported callbacks, validate C overflow/narrowing and callback-specific checks in runtime and literal types, and share mainline conversion with convenience cherry-pick/revert methods. Preserve large numeric shorthand and explicitly empty optional short arguments.
