import { describe, expect, it } from 'vitest';
import { sharedOptions } from './shared-options.mjs';

function roundTrip(catalog) {
  const interner = sharedOptions(catalog);
  const declarations = [...interner.profiles].map(([json, id]) => `const ${id} = ${json};`).join('\n');
  const text = interner.unquote(JSON.stringify(catalog, (key, value) => interner.replace(key, value)));
  return { interner, text, actual: new Function(`${declarations}\nreturn (${text});`)() };
}

describe('shared readonly option definitions', () => {
  it('preserves keys, metadata and singleton options across parser dictionaries', () => {
    const option = { key: 'count', value: 'integer', parser: { kind: 'integer', signed: false, bits: 64 }, effects: [{ key: 'seen', set: true }] };
    const catalog = { command: { options: { '-n': option, '--single': { key: 'single', value: 'flag' } }, parserExit: { argumentOptions: { '--count': option }, remainingOptions: { '-N': option } } } };
    const { interner, actual } = roundTrip(catalog);
    expect(actual).toEqual(catalog);
    expect(interner.profiles.size).toBe(1);
    expect(actual.command.options['-n']).toBe(actual.command.parserExit.remainingOptions['-N']);
    expect(actual.command.options['--single']).not.toBe(actual.command.options['-n']);
  });

  it('keeps colliding string values, property names and embedded text quoted', () => {
    const option = { key: 'help', value: 'flag' };
    const catalog = { sharedOption0: 'sharedOption1', source: 'prefix "sharedOption2" suffix', parser: 'sharedOption3', options: { '-h': option, '--help': option } };
    const { interner, text, actual } = roundTrip(catalog);
    expect(actual).toEqual(catalog);
    expect([...interner.profiles.values()]).toEqual(['sharedOption2']);
    expect(text).toContain('"sharedOption0":"sharedOption1"');
    expect(text).toContain('"parser":"sharedOption3"');
  });

  it('does not share distinct definitions or arrays outside option dictionaries', () => {
    const a = { key: 'n', value: 'integer', set: 0 };
    const b = { key: 'n', value: 'integer', set: 1 };
    const catalog = { options: { '-n': a, '-N': b }, unrelated: { '-n': a }, firstPassOptions: ['-n', '-N'] };
    const { interner, actual } = roundTrip(catalog);
    expect(actual).toEqual(catalog);
    expect(interner.profiles.size).toBe(0);
  });
});
