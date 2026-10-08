import type { Git } from '../../src/core/git.js';
declare const git: Git;
declare const count: number;
declare const large: bigint;
git.command('column', [['--width', `${count}`], ['-h']]);
git.command('column', [['--width', `${large}`], ['-h']]);
git.command('column', [['--width', `${count}k`], ['-h']]);
git.command('rev-list', [['--max-count', `1${count}`], ['--all']]);
