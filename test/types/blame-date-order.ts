import type { Git } from '../../src/index.js';
declare const git: Git;
for (const command of ['blame', 'annotate', 'pickaxe'] as const) {
  git.command(command, [['--date', 'iso'], { operand: 'HEAD' }, ['--'], { operand: 'file' }]);
  git.command(command, [['-h'], ['--date', 'invalid'], ['--diff-algorithm', 'invalid']]);
  git.command(command, [['--date', 'iso'], ['--help'], ['--date', 'invalid']]);
  git.command(command, [{ operand: 'HEAD' }, ['--'], { operand: '--date=invalid' }]);
  // @ts-expect-error Reached date callback fails before help.
  git.command(command, [['--date', 'invalid'], ['-h']]);
  // @ts-expect-error Earlier invalid modes cannot be replaced by later valid ones.
  git.command(command, [['--date', 'invalid'], ['--date', 'iso'], ['-h']]);
  // @ts-expect-error Revision operands do not stop the streaming parser.
  git.command(command, [{ operand: 'HEAD' }, ['--date', 'invalid'], ['-h']]);
  // @ts-expect-error Earlier command-owned callbacks still execute before help.
  git.command(command, [['--diff-algorithm', 'invalid'], ['-h']]);
}
