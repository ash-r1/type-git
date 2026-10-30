import { GitArgumentError } from '../../src/core/types.js';

/** The wrapper's refusal when an operand object would reach a native option position. */
export const LITERAL_OPERAND_REFUSAL =
  'Use an explicit ["--"] separator before an operand starting with a dash';

/** True when tokens contain an operand object that Git could read as an option or boundary. */
export function hasDashOperand(tokens: readonly unknown[]): boolean {
  return tokens.some(
    (token) =>
      token !== null &&
      typeof token === 'object' &&
      !Array.isArray(token) &&
      'operand' in token &&
      typeof token.operand === 'string' &&
      token.operand.startsWith('-') &&
      token.operand !== '-',
  );
}

/**
 * Native oracle corpora spell raw words as operand objects. Git may accept such a word as an
 * option, value-taking flag or boundary marker and then execute; the typed API instead refuses
 * any operand object that would be interpreted that way (docs/design/typed-command-api.md).
 */
export function isLiteralOperandRefusal(tokens: readonly unknown[], error: unknown): boolean {
  return (
    hasDashOperand(tokens) &&
    error instanceof GitArgumentError &&
    error.message === LITERAL_OPERAND_REFUSAL
  );
}

/** Run `build` and report whether it failed only with the literal-operand refusal. */
export function refusesLiteralOperand(tokens: readonly unknown[], build: () => unknown): boolean {
  try {
    build();
    return false;
  } catch (error) {
    return isLiteralOperandRefusal(tokens, error);
  }
}
