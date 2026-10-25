# mailinfo internal help

The inspected Git 2.55 source calls parse_options with flags 0 before requiring exactly two output files and invoking mailinfo. Internal help exits at its parser position. Reached quoted-cr callbacks keep their existing nowarn/warn/strip value checks, while values after actual help are not consumed. Required encoding values resembling help remain values, so they cannot bypass final output-file arity on their own.

First --help remains documentation dispatch. Completion shortcuts require a sole parser word unless earlier actual help exited. End markers, tagged literal operands, shape/NUL guards and invalid option-union arms remain enforced. Git 2.25 uses a hand-written parser; unsupported spellings return native usage failures rather than proving recognized help.

Finite controls use only options or an end marker with one operand. They never supply two output-file operands, including on the old parser, so mail parsing and output-file generation are not reached. Index, file and HEAD-file bytes are checked unchanged. Native-help comparison excludes old unsupported usage and modern final-arity usage; raw outcomes remain separate. These controls do not prove encoding transformations, binary stdin/output protocols, complete configuration or platform grammar. All command audits remain partial.
