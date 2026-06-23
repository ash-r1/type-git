/**
 * Type declarations for nodegit
 *
 * These are minimal declarations to support TypeScript compilation.
 * The actual types come from the nodegit package when installed.
 */

declare module 'nodegit' {
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const Repository: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const Clone: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const Signature: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const Reference: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const Branch: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const Commit: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const Index: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const Oid: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const Status: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const Cred: any;
}
