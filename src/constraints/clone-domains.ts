import type { CloneOpts } from '../core/git.js';
import type { Domains } from './explore.js';

/**
 * Representative, explicitly bounded domains, not all possible strings or repository states.
 * All public clone keys must be classified. Adding a CloneOpts key breaks this coverage check.
 * Invalid numeric boundary values exercise runtime-only checks as well as option relationships.
 */
export const CLONE_DOMAINS = {
  bare: [undefined, false, true],
  mirror: [undefined, false, true],
  separateGitDir: [undefined, 'separate'],
  depth: [undefined, -1, 0, 1, 2, 1.5, 2147483648, 4294967297, -4294967295],
  branch: [undefined, 'main'],
  singleBranch: [undefined, false, true],
  noCheckout: [undefined, false, true],
  recurseSubmodules: [undefined, false, true],
  cleanupOnAbort: [undefined, false, true],
  verbose: [undefined, false, true],
  quiet: [undefined, false, true],
  rejectShallow: [undefined, false, true],
  local: [undefined, false, true],
  noHardlinks: [undefined, false, true],
  shared: [undefined, false, true],
  jobs: [undefined, -1, 0, 1, 2, 1.5],
  template: [undefined, 'template'],
  reference: [undefined, 'reference'],
  referenceIfAble: [undefined, 'reference'],
  dissociate: [undefined, false, true],
  origin: [undefined, 'origin'],
  shallowSince: [undefined, '2020-01-01'],
  shallowExclude: [undefined, 'main', ['main']],
  noTags: [undefined, false, true],
  shallowSubmodules: [undefined, false, true],
  config: [undefined, { 'core.filemode': 'false' }],
  ipv4: [undefined, false, true],
  ipv6: [undefined, false, true],
  filter: [undefined, 'blob:none', 'auto', 'invalid', ''],
  alsoFilterSubmodules: [undefined, false, true],
  remoteSubmodules: [undefined, false, true],
  sparse: [undefined, false, true],
} as const satisfies Record<keyof CloneOpts, readonly unknown[]> & Domains;
