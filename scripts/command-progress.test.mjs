import { describe, expect, it } from 'vitest';
import { commandProgress, GROUPS } from './command-progress.mjs';

describe('per-command progress report', () => {
  it('reports every facet for each priority command', async () => {
    const report = await commandProgress([...GROUPS.core, ...GROUPS.next]);
    expect(report.map((entry) => entry.command)).toEqual([...GROUPS.core, ...GROUPS.next]);
    for (const { scopes } of report) {
      for (const scope of scopes) {
        expect(scope.versions.pinned).toMatch(/^\d+\.\d+\.\d+$/);
        expect(scope.argumentRules.typedCommandAPI).toBe(true);
        expect(scope.compilerTests.every((test) => test.startsWith('test/types/'))).toBe(true);
        expect(scope.nativeComparison.cases).toBe(scope.nativeComparison.corpora.reduce((n, c) => n + c.cases, 0));
      }
    }
  });

  it('selects operation scopes by command prefix and counts their native cases', async () => {
    const [stash] = await commandProgress(['stash']);
    expect(stash.scopes.map((scope) => scope.scope)).toContain('stash push');
    const push = stash.scopes.find((scope) => scope.scope === 'stash push');
    expect(push.nativeComparison.cases).toBeGreaterThan(0);
    expect(push.versions.native).toContain('2.55.0');
  });

  it('keeps every ledger sentence in exactly one bucket', async () => {
    const [{ scopes: [status] }] = await commandProgress(['status']);
    const total = status.achieved.length + status.delegation.length + status.remaining.length;
    expect(total).toBeGreaterThan(0);
    expect(new Set([...status.achieved, ...status.delegation, ...status.remaining]).size).toBe(total);
  });

  it('rejects commands without an audit record', async () => {
    await expect(commandProgress(['not-a-git-command'])).rejects.toThrow('no audit record');
  });
});
