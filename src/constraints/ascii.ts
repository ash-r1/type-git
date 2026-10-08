const ASCII_UPPERCASE = /[A-Z]/g;
export function asciiLower(value: string): string {
  return value.replace(ASCII_UPPERCASE, (character) => character.toLowerCase());
}
