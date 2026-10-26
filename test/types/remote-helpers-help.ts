import type { Git } from '../../src/index.js';
declare const git: Git;
declare const remoteHelperUsage: '-h' | '--help-all';
declare const remoteHelperUsageOrDocs: '-h' | '--help';
declare const remoteHelperName: '-h' | 'fixture';
declare const remoteHelperUrl: string;
for (const command of ['remote-fd', 'remote-ext'] as const) {
  git.command(command, [['-h']]);
  git.command(command, [['--help-all']]);
  git.command(command, [{ operand: '-h' }]);
  git.command(command, [{ operand: '--help-all' }]);
  git.command(command, [[remoteHelperUsage]]);
  git.command(command, [[remoteHelperUsageOrDocs]]);
  git.command(command, [{ operand: 'fixture' }, { operand: remoteHelperUrl }], { stdin: 'capabilities\n' });
  git.command(command, [{ operand: remoteHelperName }, { operand: remoteHelperUrl }]);
  git.command(command, [['--help'], ['--man']]);
  // @ts-expect-error A single ordinary remote word lacks its URL.
  git.command(command, [{ operand: 'fixture' }]);
  // @ts-expect-error Every one-word union arm must be a usage spelling.
  git.command(command, [{ operand: remoteHelperName }]);
  // @ts-expect-error Missing remote and URL.
  git.command(command, []);
  // @ts-expect-error Canonical usage tuples only represent sole usage.
  git.command(command, [['-h'], { operand: remoteHelperUrl }]);
  // @ts-expect-error No canonical usage union arm accepts a second word.
  git.command(command, [[remoteHelperUsage], { operand: remoteHelperUrl }]);
  // @ts-expect-error Too many normal operands.
  git.command(command, [{ operand: 'fixture' }, { operand: remoteHelperUrl }, { operand: 'extra' }]);
  // @ts-expect-error Documentation dispatch must be first-word.
  git.command(command, [{ operand: 'fixture' }, ['--help']]);
  // @ts-expect-error No separator option.
  git.command(command, [['--']]);
  // @ts-expect-error Flag takes no value.
  git.command(command, [['-h', true]]);
}
