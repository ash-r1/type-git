---
"type-git": minor
---

Check object-filter numeric limits and percent-decoded combined filters in literal command arguments. Share native unsigned-long bounds with runtime validation, preserve Git's malformed and zero-byte escape behavior, and reject decoded invalid child filters before execution. Dynamic or compiler-budget-exceeding values retain runtime validation. Keep symbolic number/bigint slots in numeric string templates eligible for runtime checks rather than rejecting potentially valid input.
