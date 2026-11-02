import { describe, expect, it } from 'vitest';
import { classify, commandProgress, GROUPS, sentences } from './command-progress.mjs';

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
    // Root-dispatch rows ("stash" with argv "stash show ...") also count toward the operation.
    const { readdir, readFile } = await import('node:fs/promises');
    const dir = new URL('../test/fixtures/', import.meta.url);
    let expected = 0;
    for (const name of (await readdir(dir)).filter((n) => n.endsWith('.json'))) {
      const cases = JSON.parse(await readFile(new URL(name, dir), 'utf8')).cases;
      if (!Array.isArray(cases)) continue;
      expected += cases.filter((row) => row?.command === 'stash show' || (row?.command === 'stash' && row.argv?.[0] === 'stash' && row.argv?.[1] === 'show')).length;
    }
    const show = stash.scopes.find((scope) => scope.scope === 'stash show');
    expect(show.nativeComparison.cases).toBe(expected);
  });

  it('keeps every ledger sentence in exactly one bucket', async () => {
    const [{ scopes: [status] }] = await commandProgress(['status']);
    const total = status.achieved.length + status.delegation.length + status.remaining.length;
    expect(total).toBeGreaterThan(0);
    expect(new Set([...status.achieved, ...status.delegation, ...status.remaining]).size).toBe(total);
  });

  it('keeps unclassified ledger text open and modeled remaining operands achieved', () => {
    expect(classify('Stash topology and working/index state')).toBe('remaining');
    expect(classify('End markers and literal remaining operands are modeled with 4,978 native cases.')).toBe('achieved');
    expect(classify('Other legacy parser differences remain open.')).toBe('remaining');
  });

  it('classifies work that remains delegated as delegation', () => {
    expect(classify('Index/worktree state and configuration remain delegated to native Git.')).toBe('delegation');
    expect(classify('dynamic or compiler-budget-exceeding literals remain separate obligations.')).toBe('remaining');
  });

  it('splits sentence and semicolon boundaries regardless of case', () => {
    expect(sentences('A is modeled; b remains open. c is checked.')).toEqual(['A is modeled', 'b remains open.', 'c is checked.']);
  });

  it('splits semicolon clauses and keeps open work out of delegation', async () => {
    const [{ scopes: [show] }] = await commandProgress(['show']);
    const open = [...show.remaining, ...show.delegation].find((s) => /^dynamic or compiler-budget-exceeding literals/.test(s));
    expect(open).toBeDefined();
    expect(show.remaining).toContain(open);
    expect(show.achieved.some((s) => /^Numeric bounds .* are checked/.test(s))).toBe(true);
  });

  it('rejects commands without an audit record', async () => {
    await expect(commandProgress(['not-a-git-command'])).rejects.toThrow('no audit record');
  });
});
