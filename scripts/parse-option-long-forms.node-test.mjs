import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOptionLongForms } from './parse-option-long-forms.mjs';
const option = (long, flags = '') => ({ kind: 'OPTION_STRING', long, fields: { flags } });
const alias = (long, source) => ({ kind: 'OPTION_ALIAS', long, fields: { value: `(char *)(${JSON.stringify(source)})` } });

test('native alias pairs suppress ambiguity only for matching parsed flags', () => {
  const forms = parseOptionLongForms([option('alpha'), alias('alpine', 'alpha')], true);
  assert.equal(forms.plain['--al'], '--alpine');
  assert.equal(forms.attached['--al'], '--alpine');
  assert.equal(forms.plain['--no-al'], '--no-alpine');
  assert.equal(forms.plain['--alpha'], '--alpha');
  assert.equal(forms.plain['--alpine'], '--alpine');
  // Two aliases sharing a source are not a pair in native is_alias.
  const siblings = parseOptionLongForms([option('base'), alias('alias-one', 'base'), alias('alias-two', 'base')], true);
  assert.equal(siblings.plain['--alias-'], null);
  // A previous unrelated collision remains ambiguous after a later alias pair.
  const sticky = parseOptionLongForms([option('alder'), option('alpha'), alias('alpine', 'alpha')], true);
  assert.equal(sticky.plain['--al'], null);
  // Exact matches take precedence over the saved ambiguous abbreviation.
  assert.equal(parseOptionLongForms([option('alder'), option('alpha'), option('al')], true).plain['--al'], '--al');
});

test('aliases inherit target flags and exact-only mode still disables abbreviation', () => {
  const definitions = [option('alpha', 'PARSE_OPT_NONEG'), alias('alpine', 'alpha')];
  const forms = parseOptionLongForms(definitions, true);
  assert.equal(forms.plain['--al'], '--alpine');
  assert.equal(forms.plain['--no-alpine'], undefined);
  const exact = parseOptionLongForms(definitions, false);
  assert.equal(exact.plain['--al'], undefined);
  assert.equal(exact.plain['--alpine'], '--alpine');
  assert.throws(() => parseOptionLongForms([alias('alias', 'missing')], true), /Invalid native alias/);
  assert.throws(() => parseOptionLongForms([option('base'), alias('one', 'base'), alias('two', 'one')], true), /Nested native alias/);
});

test('very short negations retain their distinct native OPT_LONG flag', () => {
  // --n registers both the positive prefix and the very short negated form.
  const forms = parseOptionLongForms([option('normal'), alias('normal-alias', 'normal')], true);
  assert.equal(forms.plain['--n'], null);
  assert.equal(forms.attached['--n'], '--normal-alias');
  assert.equal(forms.plain['--no'], null);
  assert.equal(forms.attached['--no'], '--normal-alias');
});
