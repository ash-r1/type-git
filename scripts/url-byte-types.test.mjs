import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

describe('percent-decoded byte table character identity', () => {
  it('retains every nonzero byte after formatting and TypeScript parsing', () => {
    const text = readFileSync(new URL('../src/constraints/url-byte-types.ts', import.meta.url), 'utf8');
    const source = ts.createSourceFile('url-byte-types.ts', text, ts.ScriptTarget.Latest, true);
    const alias = source.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'UrlBytes');
    expect(ts.isTypeLiteralNode(alias.type)).toBe(true);
    const bytes = new Map(alias.type.members.map(member => [member.name.text, member.type.literal.text]));
    expect(bytes.size).toBe(255);
    expect(bytes.has('00')).toBe(false);
    for (let byte = 1; byte < 256; byte++) {
      const value = bytes.get(byte.toString(16).padStart(2, '0'));
      expect(value.length).toBe(1);
      expect(value.charCodeAt(0), `byte ${byte.toString(16)}`).toBe(byte);
    }
    expect(bytes.get('7f')).toBe('\u007f');
    expect(bytes.get('80')).toBe('\u0080');
    expect(bytes.get('9f')).toBe('\u009f');
  });
});
