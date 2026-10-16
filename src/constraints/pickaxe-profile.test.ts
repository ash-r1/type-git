import { expect, it } from 'vitest';
import fixture from '../../test/fixtures/pickaxe-empty-probe-native.json';
import { pickaxeEmptyRejected } from './pickaxe-profile.js';

it.for(fixture.cases)('classifies the native empty callback on $source', (row) => {
  expect(pickaxeEmptyRejected(row)).toBe(row.rejectsEmpty);
});
it('leaves aborted, localized and unrelated responses unclassified', () => {
  const modern = fixture.cases.find((row) => row.rejectsEmpty)!;
  for (const result of [
    { ...modern, aborted: true },
    { ...modern, exitCode: 128 },
    { ...modern, stdout: 'unexpected' },
    { ...modern, stderr: 'error: localized callback\n' },
    { ...modern, stderr: `${modern.stderr}fatal: another failure\n` },
  ]) {
    expect(pickaxeEmptyRejected(result)).toBeUndefined();
  }
});

it('does not infer an old callback from usage followed by unrelated fatal output', () => {
  const legacy = fixture.cases.find((row) => !row.rejectsEmpty)!;
  expect(
    pickaxeEmptyRejected({ ...legacy, stderr: `${legacy.stderr}fatal: unrelated failure\n` }),
  ).toBeUndefined();
});
