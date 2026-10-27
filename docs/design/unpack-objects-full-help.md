# unpack-objects full usage

A canonical sole `[["--help-all"]]` now reaches selected native Git usage handling. Git 2.55.0 invokes `show_usage_if_asked` before its handwritten option loop; Git 2.25.1 reaches unknown-option usage instead. Native status and output streams remain unchanged, including repository-setup failures outside a repository. Existing short-help, documentation-help, zero-operand stdin mode, and option callbacks remain unchanged.

When validation reaches the full-help tuple it requires exactly one word. Ordinary operands remain rejected. Outside controls share a parent-directory ceiling, assert failed repository discovery, and exercise a temporary directory nested under an actual repository.

Finite ordinary controls only read an actual SHA-1 one-blob pack from a separate source repository with `-n` (plain, quiet, recovery, strict). The blob is absent in the target before and after every control; target object-store file hashes, index, HEAD, config, and working file stay unchanged. Outside dry-run controls use empty stdin because repository setup fails before reading a pack. Ordinary unpacking, corrupt/thin packs, SHA-256, transfer and platform-wide parity are not covered. All 430 audit scopes remain partial.
