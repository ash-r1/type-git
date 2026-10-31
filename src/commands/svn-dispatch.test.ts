import { expect, it } from 'vitest';
import { svnDispatch, svnParserTokens } from './svn-dispatch.js';

const commands = { fetch: 'svn fetch', init: 'svn init' };
it('removes a command selected inside a detached value before options consume words', () => {
  expect(svnDispatch(['-i', 'fetch', 'init', '-h'], commands)).toEqual({
    kind: 'command',
    command: 'svn fetch',
    index: 1,
    remaining: ['-i', 'init', '-h'],
  });
  expect(svnDispatch(['--id=fetch', 'init', '-h'], commands)).toEqual({
    kind: 'command',
    command: 'svn init',
    index: 1,
    remaining: ['--id=fetch', '-h'],
  });
});
it('scans past operands and separators, stopping at the first command', () => {
  expect(svnDispatch(['ignored', '--', 'fetch', 'init'], commands)).toEqual({
    kind: 'command',
    command: 'svn fetch',
    index: 2,
    remaining: ['ignored', '--', 'init'],
  });
});
it('help exits before later parsing, but does not preempt an earlier command', () => {
  expect(svnDispatch(['--id', 'help', 'fetch', '--unknown'], commands)).toEqual({
    kind: 'help',
    command: 'fetch',
  });
  expect(svnDispatch(['fetch', 'help', 'init'], commands).kind).toBe('command');
  expect(svnDispatch(['help'], commands)).toEqual({ kind: 'help', command: undefined });
  expect(svnDispatch(['--id=help'], commands)).toEqual({ kind: 'none' });
});
it('uses own command keys instead of inherited object properties', () => {
  expect(svnDispatch(['constructor', 'toString'], commands)).toEqual({ kind: 'none' });
});

it('reconstructs option values after the command word has been removed', () => {
  const options = {
    '-i': { value: 'string' },
    '--id': { value: 'string' },
    '-h': { value: 'flag' },
  };
  expect(svnParserTokens(['-i', 'init', '-h'], options)).toEqual([['-i', 'init'], ['-h']]);
  expect(svnParserTokens(['--id=fetch', '-h'], options)).toEqual([['--id', 'fetch'], ['-h']]);
  expect(svnParserTokens(['--', '-i', 'init'], options)).toEqual([
    ['--'],
    { operand: '-i' },
    { operand: 'init' },
  ]);
  expect(svnParserTokens(['-i', 'x', '-', '-h'], options)).toEqual([
    ['-i', 'x'],
    { operand: '-' },
    ['-h'],
  ]);
  expect(svnParserTokens(['-i'], options)).toBeUndefined();
  expect(svnParserTokens(['--unknown'], options)).toBeUndefined();
  expect(svnParserTokens(['-h=value'], options)).toBeUndefined();
});
