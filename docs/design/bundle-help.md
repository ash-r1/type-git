# Bundle parser help and completion

Git 2.55.0 `builtin/bundle.c:parse_options_cmd_bundle` calls `parse_options`
with `PARSE_OPT_STOP_AT_NON_OPTION` for create, verify, list-heads and
unbundle. Reached help exits before the required file check, and before
create's later bundle-format check. Earlier integer callback errors remain
errors. The first file operand and `--` end option recognition; later help
words must remain literal operands in the public representation.

Usage exits now support a single parser that stops at its first operand.
They still cannot be combined with staged parser-exit metadata or a
handwritten no-option parser. Prefix checking preserves the stop boundary
before admitting ignored unknown option words. Known tuple arity and argv
NUL checks remain independent of help.

Both completion helper spellings require exactly one parser word. Their
checked single-word exit bypasses the final file requirement. A helper in
front of another word remains unknown; a helper after reached help is
ignored. No common native help exit status is imposed: Git 2.56 differs
from earlier selected versions, and tests compare actual status and output.
An unavailable helper spelling in older Git retains its native unknown-option result.

A fresh-main baseline compared 612 native/public cases across Git 2.25,
2.39, 2.43, 2.47, 2.55 and 2.56. It found 252 false API rejections of
native help or completion exits. Fixture snapshots remained unchanged.
Expected prefix errors and options-after-file representation errors are
separate controls.

All command audits remain partial. Real bundle creation, prerequisites,
object formats, repository state, revision selection and broader platform
or source-version behavior remain independent audit obligations.
