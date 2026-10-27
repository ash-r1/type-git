import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('rev-parse', [['--help-all']]);
git.command('rev-parse', [['--help-all'], { operand: 'HEAD' }]);
git.command('rev-parse', [['--verify'], ['--help-all']]);
// @ts-expect-error Multiword full-help does not bypass callback validation.
git.command('rev-parse', [['--help-all'], ['--path-format', 'invalid']]);
// @ts-expect-error Earlier invalid callbacks remain rejected.
git.command('rev-parse', [['--path-format', 'invalid'], ['--help-all']]);
// @ts-expect-error Full-help is a value-less flag.
git.command('rev-parse', [['--help-all', true]]);
// @ts-expect-error Unknown options are not enabled by full-help.
git.command('rev-parse', [['--help-all'], ['--not-a-rev-parse-option']]);
