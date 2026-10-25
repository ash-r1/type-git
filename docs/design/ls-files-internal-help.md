# ls-files internal help

Git 2.25 and 2.55 read the index before calling parse_options with flags 0. Internal -h, later --help and --help-all exit at their parser position. A first --help belongs to documentation dispatch. Sole completion words are handled separately; older unsupported completion spellings remain native errors.

Reached abbreviation callbacks validate their value before later help. The exclude-from callback reads the supplied file immediately and can fail before help. Earlier help skips those later callbacks. Format, recursion and with-tree mode checks occur after parsing and can be bypassed by help. The API delegates native file access and preserves native failures.

Known option catalogue, value shape and NUL guards still apply after help. Required values and tagged operands resembling help do not create an exit. An end marker keeps later tagged words as operands.

The finite four-Linux-Git corpus covers help, completion, numeric/file callback order and final-mode cases. Index, tracked file and HEAD-file bytes are checked unchanged in an isolated repository. This does not establish all path/object languages, corrupt-index behavior, repository configurations, payloads or platforms. All command audits remain partial.
