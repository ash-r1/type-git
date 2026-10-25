# for-each-repo internal help

The inspected Git 2.55 source parses options with STOP_AT_NON_OPTION before checking for a config key, looking up its values and iterating repositories. Internal help exits at its parser position; required config values resembling help remain values. Invalid config-key lookup after parsing is skipped by earlier actual help. Option parsing stops at the first operand; tagged later help-looking words remain delegated command arguments and option tuples cannot resume parsing.

First --help remains documentation dispatch. Completion shortcuts require a sole parser word unless earlier actual help has exited. End markers, shape/NUL guards and invalid option-union arms remain enforced. Git 2.25 has no for-each-repo command; unsupported native outcomes remain failures, without a version-support claim.

Finite controls isolate configuration and use only help/error invocations or an unconfigured typegit.missing key. The source returns before repository iteration for an unconfigured key, so no child command is invoked. Index, file and HEAD-file bytes are checked unchanged after each comparison. These controls do not prove successful repository iteration, delegated child behavior, complete configuration or platform grammar. All command audits remain partial.
