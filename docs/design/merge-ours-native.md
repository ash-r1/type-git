# merge-ours native argument handling

The inspected Git 2.25 and 2.55 sources do not use parse-options. Apart from a sole usage shortcut, merge-ours ignores argv and compares the index with HEAD: a matching index returns 0 and a differing index returns 2. Conventional base, separator, HEAD and remote words are not independently validated. Arbitrary ignored words remain representable as tagged operands.

A canonical --help-all flag is accepted without adding a generic parser exit. In the finite observations, Git 2.25/2.47 ignore that sole word and return the index-comparison result; Git 2.55 prints usage with 129; Git 2.56 prints usage with 0. The selected executable decides the outcome. Multiword help-looking arguments do not bypass the index comparison. Existing optionParsing:none, separator:false, shape and NUL guards remain intact. A -- option tuple is invalid API representation; a tagged -- is an ignored literal word.

Finite controls compare clean and explicitly staged fixtures and check index, tracked-file and HEAD-file byte invariance after every native/API call. They do not perform an actual merge, commit or ref update and do not prove all index/configuration/platform behavior. All command audits remain partial.
