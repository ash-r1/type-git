/**
 * Type declarations for isomorphic-git
 *
 * These are minimal declarations to support TypeScript compilation.
 * The actual types come from the isomorphic-git package when installed.
 */

declare module 'isomorphic-git' {
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  const git: any;
  export default git;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const clone: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const init: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const add: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const commit: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const log: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const statusMatrix: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const listBranches: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const branch: any;
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  export const resolveRef: any;
}
