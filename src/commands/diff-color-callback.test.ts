import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

const continuing = ['diff', 'diff-files', 'diff-index', 'diff-tree', 'rev-list'] as const;
const streaming = ['diff --no-index', 'range-diff', 'diff-pairs'] as const;
const deferred = ['backfill', 'last-modified', 'replay'] as const;

describe('diff color callback reachability', () => {
  it('checks reached color values before and after help in continuing revision parsers', () => {
    for (const command of continuing) {
      for (const help of ['-h', '--help-all']) {
        for (const value of ['', 'true', 'false', ' invalid', 'invalid']) {
          expect(() => commandArguments(command, [['--color', value], [help]])).toThrow();
          expect(() => commandArguments(command, [[help], ['--color', value]])).toThrow();
        }
        for (const value of ['always', 'AUTO', 'NeVeR']) {
          if (help === '--help-all') {
            expect(() => commandArguments(command, [['--color', value], [help]])).toThrow();
          } else {
            expect(commandArguments(command, [['--color', value], [help]])).toContain(
              `--color=${value}`,
            );
          }
        }
      }
    }
  });
  it('stops local usage parsers before later color callbacks', () => {
    for (const command of streaming) {
      for (const help of ['-h', '--help-all']) {
        expect(() => commandArguments(command, [['--color', 'invalid'], [help]])).toThrow();
        expect(commandArguments(command, [[help], ['--color', 'invalid']])).toContain(
          '--color=invalid',
        );
        expect(commandArguments(command, [[help], ['--unknown-tail', 'kept']])).toContain(
          '--unknown-tail',
        );
      }
    }
  });
  it('exits initial help before deferred color callbacks in either token order', () => {
    for (const command of deferred) {
      for (const help of ['-h', '--help-all']) {
        expect(commandArguments(command, [['--color', 'invalid'], [help]])).toContain(
          '--color=invalid',
        );
        expect(commandArguments(command, [[help], ['--color', 'invalid']])).toContain(
          '--color=invalid',
        );
      }
      expect(() => commandArguments(command, [['--color', 'invalid']])).toThrow();
    }
  });
  it('retains shape and NUL checks in ignored color tails', () => {
    for (const command of [...streaming, ...deferred]) {
      expect(() => commandArguments(command, [['-h'], ['--color', '\0']])).toThrow('NUL');
      expect(() => commandArguments(command, [['-h'], ['--color', 42]])).toThrow();
    }
  });
});
