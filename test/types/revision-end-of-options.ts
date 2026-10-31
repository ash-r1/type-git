import type { Git } from '../../src/index.js';
declare const git: Git;
// Words after --end-of-options are operands, even when they look like options.
git.command('log', [{ operand: '--end-of-options' }, { operand: '--bogus' }]);
git.command('log', [{ operand: 'HEAD' }, { operand: '--end-of-options' }, { operand: '--bogus' }]);
git.command('log', [
  { operand: '--end-of-options' },
  { operand: '--bogus' },
  ['--'],
  { operand: 'path' },
]);
// @ts-expect-error A deferred unknown long option still fails the final usage check.
git.command('log', [{ operand: '--bogus' }, { operand: '--end-of-options' }, { operand: 'HEAD' }]);
// @ts-expect-error A deferred unknown short cluster still fails the final usage check.
git.command('log', [{ operand: '-Q' }, { operand: '--end-of-options' }, { operand: 'HEAD' }]);
// @ts-expect-error The path boundary does not hide a deferred unknown before --end-of-options.
git.command('log', [
  { operand: '--bogus' },
  { operand: '--end-of-options' },
  ['--'],
  { operand: 'path' },
]);
