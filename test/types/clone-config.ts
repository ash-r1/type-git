import type { CloneConfig } from '../../src/core/clone-config.js';
import type { CloneOpts } from '../../src/core/git.js';
export const accepted: CloneOpts = {
  config: {
    'user.name': 'A',
    'core.autocrlf': 'input',
    'http.extraHeader': 'Authorization: Bearer x',
    'http.https://example.com/.sslVerify': 'false',
  },
};
// @ts-expect-error protocol.ext.allow enables the ext:: transport
export const ext: CloneConfig = { 'protocol.ext.allow': 'always' };
// @ts-expect-error include.path loads arbitrary config
export const include: CloneConfig = { 'include.path': '/tmp/x' };
// @ts-expect-error core.sshCommand names a program
export const ssh: CloneConfig = { 'core.sshCommand': 'x' };
// @ts-expect-error http.cookieFile is not a data-only clone key
export const cookie: CloneConfig = { 'http.https://example.com/.cookieFile': 'x' };
// @ts-expect-error core.autocrlf takes true, false or input
export const autocrlf: CloneConfig = { 'core.autocrlf': 'yes' };
