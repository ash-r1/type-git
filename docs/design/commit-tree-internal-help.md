# commit-tree internal help

Git 2.25 and 2.55 parse options before requiring exactly one tree and generating a commit. Internal help exits at its parser position. Parent resolution and message-file reads reached before help still run; the same callbacks after help are skipped. Required message values resembling help remain values, and final tree checks still apply when no parser exit is reached.

First --help remains documentation dispatch. Completion shortcuts require a sole parser word unless earlier help already exited. End markers, tagged literal operands, shape/NUL guards and invalid option-union arms remain enforced. Existing native usage exit codes and repository-setup failures remain separate outcomes.

Finite tests use only help and error invocations in isolated fixtures. They provide no valid tree operand for commit generation and never invoke a signer. Parent HEAD and existing-message-file controls end in help. Index, file and HEAD-file bytes are checked unchanged after every native/API comparison. These controls do not prove complete object writes, signing/configuration, binary stdin, callback languages or all platform/version grammar. All command audits remain partial.
