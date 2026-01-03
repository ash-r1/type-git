/**
 * Type declarations for wasm-git packages
 *
 * These are minimal declarations to support TypeScript compilation.
 * The actual types come from the respective packages when installed.
 */

declare module '@aspect-build/aspect-git-wasm' {
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  const wasmGit: any;
  export default wasmGit;
}

declare module 'wasm-git' {
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  const wasmGit: any;
  export default wasmGit;
}

declare module 'lg2' {
  // biome-ignore lint/suspicious/noExplicitAny: external library stub
  const wasmGit: any;
  export default wasmGit;
}
