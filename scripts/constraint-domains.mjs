import ts from 'typescript';
import { scalarRepresentatives } from './scalar-domains.mjs';

/** Deterministic structural representatives, with explicit boundaries for model predicates.
 * These are NOT a grammar for every possible string, nor an upstream constraint extractor.
 */
export function representatives(type, aliases, seen = new Set()) {
  if (!type) throw new Error('Option type is missing');
  if (type.kind === ts.SyntaxKind.StringKeyword) return ['', 'value'];
  if (type.kind === ts.SyntaxKind.NumberKeyword) return [-1, 0, 1, 2, 1.5, Number.MAX_SAFE_INTEGER + 1];
  if (type.kind === ts.SyntaxKind.BooleanKeyword) return [false, true];
  if (type.kind === ts.SyntaxKind.NeverKeyword) return [];
  if (ts.isFunctionTypeNode(type)) return [() => undefined];
  if (ts.isUnionTypeNode(type)) return type.types.flatMap((t) => representatives(t, aliases, seen));
  if (ts.isLiteralTypeNode(type)) {
    const value = type.literal;
    if (ts.isStringLiteral(value)) return [value.text];
    if (ts.isNumericLiteral(value)) return [Number(value.text)];
    if (value.kind === ts.SyntaxKind.TrueKeyword) return [true];
    if (value.kind === ts.SyntaxKind.FalseKeyword) return [false];
    if (ts.isPrefixUnaryExpression(value) && ts.isNumericLiteral(value.operand)) return [-Number(value.operand.text)];
  }
  if (ts.isParenthesizedTypeNode(type)) return representatives(type.type, aliases, seen);
  if (ts.isArrayTypeNode(type)) return [[], ...representatives(type.elementType, aliases, seen).map((value) => [value])];
  if (ts.isTupleTypeNode(type)) return [type.elements.filter((e) => !ts.isRestTypeNode(e) && !ts.isOptionalTypeNode(e)).map((e) => representatives(e, aliases, seen)[0])];
  if (ts.isTypeLiteralNode(type)) {
    const value = {};
    for (const member of type.members) {
      if (!ts.isPropertySignature(member)) throw new Error(`Unsupported object member: ${member.getText()}`);
      if (!member.questionToken) value[member.name.getText()] = representatives(member.type, aliases, seen)[0];
    }
    return [value];
  }
  if (ts.isTypeReferenceNode(type)) {
    const name = type.typeName.getText();
    if (name === 'Date') return [new Date('2000-01-01T00:00:00Z')];
    if (name === 'Record') return [{ key: representatives(type.typeArguments[1], aliases, seen)[0] }];
    if (seen.has(name)) throw new Error(`Recursive option type needs an explicit domain: ${name}`);
    if (aliases.has(name)) return representatives(aliases.get(name), aliases, new Set([...seen, name]));
  }
  throw new Error(`Option type needs an explicit domain: ${type.getText()}`);
}

export function optionDomains(options, aliases, rules = []) {
  return Object.fromEntries(options.members.map((member) => {
    if (!ts.isPropertySignature(member)) throw new Error(`Unsupported option declaration: ${member.getText()}`);
    const values = [...(member.questionToken ? [undefined] : []), ...representatives(member.type, aliases)];
    const kinds = new Set(values.filter(value => value !== undefined).map(value => typeof value));
    for (const rule of rules) if (rule.kind === 'scalar' && rule.key === member.name.getText()) values.push(...scalarRepresentatives(rule.parser).filter(value => kinds.has(typeof value)));
    const unique = [...new Map(values.map((value) => [literal(value), value])).values()];
    return [member.name.getText(), unique];
  }));
}

export function literal(value) {
  if (typeof value === 'function') return '() => undefined';
  if (value === undefined) return 'undefined';
  if (value instanceof Date) return `new Date(${JSON.stringify(value.toISOString())})`;
  if (Array.isArray(value)) return `[${value.map(literal).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).map(([key, v]) => `${JSON.stringify(key)}:${literal(v)}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Representable projection for non-generic public option objects (broad string/number fields). */
export function compilerRules(rules) {
  return rules.flatMap((rule) => {
    if (rule.kind === 'integer' || rule.kind === 'range' || rule.kind === 'scalar') return [];
    // Excluding positive numbers cannot be expressed as a complement of TS number.
    if (rule.kind === 'forbid' && rule.when.some((p) => p.test === 'bytesPositive')) return [];
    if (rule.kind === 'conflicts') return [{ ...rule, others: rule.others.filter((p) => p.test !== 'positive') }];
    return [rule];
  });
}
