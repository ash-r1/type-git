import type { Git } from '../../src/index.js';
declare const git: Git;
declare const dynamic: string;
declare const either: '0' | '1';
for (const command of ['blame', 'annotate', 'pickaxe'] as const) {
  git.command(command,[['-L','0'],['-h']]);
  git.command(command,[['-h'],['-L','0']]);
  git.command(command,[['-L','3,1'],{operand:'file'}]);
  git.command(command,[['-L',''],{operand:'file'}]);
  git.command(command,[['-L',dynamic],{operand:'file'}]);
  git.command(command,[['-L','/pattern/,0'],{operand:'file'}]);
  // @ts-expect-error A reached absolute numeric boundary must be positive.
  git.command(command,[['-L','0'],{operand:'file'}]);
  // @ts-expect-error Negative absolute starts are rejected by native Git.
  git.command(command,[['-L','-1'],{operand:'file'}]);
  // @ts-expect-error Relative lengths must be nonzero.
  git.command(command,[['-L','1,+0'],{operand:'file'}]);
  // @ts-expect-error Every range must be checked, not only the final one.
  git.command(command,[['-L','0'],['-L','1'],{operand:'file'}]);
  // @ts-expect-error Known invalid alternatives cannot be silently discarded.
  git.command(command,[['-L',either],{operand:'file'}]);
}
