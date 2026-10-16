import type { AuditEvent, GitError, RawResult } from '../../src/core/types.js';
declare const text: RawResult;
declare const bytes: RawResult<Uint8Array>;
declare const event: AuditEvent;
declare const error: GitError;
export const rawSignal: string | undefined = text.signal;
export const byteSignal: string | undefined = bytes.signal;
export const errorSignal: string | undefined = error.context.signal;
if (event.type === 'end') {
  const signal: string | undefined = event.signal;
  void signal;
}
