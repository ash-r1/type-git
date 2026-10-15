import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gitOptions } from './git-options.mjs';
/** Load the pinned source metadata used to exercise catalogue generation. */
const load = name => JSON.parse(readFileSync(new URL(`../spec/${name}.json`, import.meta.url), 'utf8'));
const upstream = load('upstream/git-option-tables');
const numeric = load('upstream/git-numeric-options');
const scopes = load('git-command-scopes');
const rules = load('git-command-rules');
const groups = load('git-option-groups');
describe('source-declared integer width coverage', () => {
  it('retains all declared long and size_t bindings in the current catalogue', () => {
    const result = gitOptions(upstream, scopes, rules, groups, numeric);
    expect(result['pack-objects'].options['--max-pack-size'].parser.nativeWidth).toBe('long');
    expect(result.backfill.options['--min-batch-size'].parser.nativeWidth).toBe('size_t');
  });
  it('rejects a new unsigned 64-bit binding without a source width declaration', () => {
    const changed = structuredClone(upstream);
    const snapshot = structuredClone(numeric);
    const file = changed.files.find(f => f.file === 'builtin/pack-objects.c');
    const table = file.tables.find(t => t.options.some(o => o.long === 'max-pack-size'));
    table.options.find(o => o.long === 'max-pack-size').long = 'unmapped-pack-size';
    snapshot.options.find(o => o.file === file.file && o.table === table.name && o.flag === 'max-pack-size').flag = 'unmapped-pack-size';
    expect(() => gitOptions(changed, scopes, rules, groups, snapshot)).toThrow('Unsigned 64-bit option lacks a source-declared native width');
  });
  it('rejects a stale source width declaration even when no unmapped option remains', () => {
    const changed = structuredClone(upstream);
    for (const file of changed.files.filter(f => f.file === 'builtin/pack-objects.c')) {
      for (const table of file.tables) table.options = table.options.filter(o => o.long !== 'max-pack-size');
    }
    expect(() => gitOptions(changed, scopes, rules, groups, numeric)).toThrow('Unused source-declared native width: builtin/pack-objects.c:max-pack-size');
  });
});

describe('ordered parser wrapper source metadata', () => {
  it('rejects wrappers without a first-pass table before emitting raw source metadata', () => {
    const changed = structuredClone(scopes);
    delete changed['reflog show'].parserExit.firstPassTables;
    expect(() => gitOptions(upstream, changed, rules, groups, numeric)).toThrow('parser wrappers require firstPassTables');
  });
});

describe('retained argument partition state namespace', () => {
  it('rejects a partition that would overwrite the second normalized operand', () => {
    const changed = structuredClone(scopes);
    changed['stash show'].parserExit.remainingPartition.operandKey = 'operand1';
    expect(() => gitOptions(upstream, changed, rules, groups, numeric)).toThrow('invalid or colliding retained-word partition');
  });
});
