# index-pack full usage

A canonical sole `[["--help-all"]]` now reaches selected native Git before pack-input arity validation. Git 2.55.0 invokes `show_usage_if_asked` before option handling; Git 2.25.1 instead reaches unknown-option usage. Native status and output streams remain unchanged, including repository-setup failures outside a repository. Existing short-help and documentation-help behavior is unchanged.

When validation reaches the full-help tuple, it requires exactly one word. Other option callbacks, pack-input arity, and tagged dash-leading operand restrictions remain active. Outside controls share a parent-directory ceiling, assert failed repository discovery, and exercise a temporary directory nested under an actual repository.

Finite ordinary controls only verify an actual SHA-1 pack and its existing index, including strict, thread-count, and verbose forms. Every object-store file is fingerprinted to detect pack/index/reverse-index writes, alongside the ordinary index, HEAD, config, and working file. This does not exercise ordinary index creation, thin packs, corrupt packs, SHA-256, fetches, or platform-wide parity. All 430 audit scopes remain partial.
