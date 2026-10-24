# Utility parser help ordering

Git 2.55.0 `builtin/column.c`, `builtin/fmt-merge-msg.c` and `builtin/update-ref.c` call `parse_options` with flags zero. Their registered options do not replace short `-h`. Internal `-h`, `--help` and `--help-all` exit at their parser position. First `--help` belongs to the Git documentation dispatcher; first `--help-all` remains internal.

The scope metadata uses the existing ordered exit mechanism. Earlier integer callbacks still reject invalid values. Later callbacks and final checks (column padding and operand checks, fmt-merge-msg file opening, and update-ref reflog message/mode/arity checks) are bypassed. Required option values that look like help remain values, and the end marker keeps later help words as operands.

`parse-options.c:parse_options_step` recognizes completion helpers only when the parser receives one word. Scope-local immediate arity checks reject a reached multiword helper, while earlier help exits first. Sole helpers delegate to the selected Git binary: Git 2.25 does not support `--git-completion-helper-all`, so its actual unknown-option failure remains observable. The matching native error is retained as an error, rather than counted as a successful completion command.

The focused integration tests use an isolated committed repository and empty stdin, comparing actual exit status, stdout and stderr. Short required option values, including an empty reflog message, are separate native argv words. All tested update-ref paths exit before ref changes. Static fixtures exercise literal rejection and acceptance separately. These finite cases do not establish exhaustive callback, configuration, version or platform coverage; all three command audits remain partial.
