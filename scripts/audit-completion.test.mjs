import { describe, expect, it } from 'vitest';
import {
  checkClosureShape,
  closureSourceProblems,
  completionGaps,
  REQUIRED_KINDS,
  siteLabel,
} from './audit-completion.mjs';
import { referencedFunctions, refusalSites } from './refusal-sites.mjs';

const FACETS = ['option-grammar', 'operand-grammar'];
const EXCLUSIONS = { 'other-git-versions': { reason: 'baseline only', kinds: ['parser', 'platform'] } };
const evidence = { 'option-grammar': ['a'], 'operand-grammar': ['b'] };
const OPTIONS = { facets: FACETS, baseline: '2.55.0' };

/** A closure that meets every criterion: one refusal site plus each required kind. */
const closure = () => ({
  git: '2.55.0',
  entry: 'cmd_x',
  sources: { 'builtin/x.c': ['cmd_x'] },
  obligations: [
    { id: 'bad-mode', kind: 'refusal', sites: ['cmd_x: bad mode'], disposition: 'modeled', summary: 's', evidence: ['test/fixtures/x.json'] },
    ...REQUIRED_KINDS.map((kind) => ({ id: kind, kind, disposition: 'delegated', basis: 'configuration', summary: 's', reason: 'r' })),
  ],
});
const shape = (mutate) => () => {
  const c = closure();
  mutate(c);
  checkClosureShape('x', c, EXCLUSIONS);
};

describe('audit completion criterion', () => {
  it('has no gaps when facets, closure and dispositions are all closed', () => {
    const record = { evidence, closure: closure() };
    checkClosureShape('x', record.closure, EXCLUSIONS);
    expect(completionGaps(record, OPTIONS)).toEqual([]);
  });

  it('reports missing facets, a missing closure and prose remaining', () => {
    expect(completionGaps({ remaining: 'Open work.' }, OPTIONS)).toEqual([
      'facet:option-grammar',
      'facet:operand-grammar',
      'closure',
      'unclassified-remaining',
    ]);
  });

  it('waives only operand and combination facets, and only with a reason', () => {
    const base = { evidence: { 'option-grammar': ['a'] }, closure: closure() };
    expect(completionGaps({ ...base, inapplicableFacets: { 'operand-grammar': 'no operands' } }, OPTIONS)).toEqual([]);
    expect(completionGaps({ ...base, inapplicableFacets: { 'operand-grammar': ' ' } }, OPTIONS)).toEqual(['facet:operand-grammar']);
    const noOptions = { evidence: { 'operand-grammar': ['b'] }, closure: closure(), inapplicableFacets: { 'option-grammar': 'none' } };
    expect(completionGaps(noOptions, OPTIONS)).toEqual(['facet:option-grammar']);
  });

  it('keeps open obligations, missing kinds and another baseline as gaps', () => {
    const c = closure();
    c.obligations = c.obligations.filter((o) => o.kind !== 'platform');
    c.obligations[1] = { ...c.obligations[1], disposition: 'open', reason: 'not yet' };
    expect(completionGaps({ evidence, closure: c }, { ...OPTIONS, baseline: '2.56.0' })).toEqual([
      'closure-baseline',
      'kind:platform',
      'open:parser',
    ]);
  });

  it('rejects closures that rest on nothing', () => {
    expect(shape((c) => { c.obligations[0].disposition = 'delegated'; c.obligations[0].basis = 'configuration'; c.obligations[0].reason = 'r'; })).toThrow('models nothing');
    expect(shape((c) => { c.entry = 'cmd_y'; })).toThrow('does not list its entry point');
    expect(shape((c) => { c.obligations[0] = { ...c.obligations[0], disposition: 'excluded', exclusion: 'other-git-versions' }; })).toThrow('cannot be excluded');
  });

  it('rejects malformed obligations', () => {
    expect(shape((c) => { c.obligations[0].evidence = []; })).toThrow('modeled without evidence');
    expect(shape((c) => { c.obligations[0].evidence = ['../outside']; })).toThrow('not a repository file');
    expect(shape((c) => { c.obligations[0].evidence = ['package.json']; })).toThrow('not a repository file');
    expect(shape((c) => { c.obligations[1].reason = ''; })).toThrow('delegated without a reason');
    expect(shape((c) => { c.obligations[1].basis = 'because'; })).toThrow('without a basis');
    expect(shape((c) => { c.obligations[1].sites = ['cmd_x: other']; })).toThrow('only refusal obligations');
    expect(shape((c) => { c.obligations[0].sites = 'cmd_x: bad mode'; })).toThrow('names no site');
    expect(shape((c) => { c.obligations.push({ ...c.obligations[0], id: 'again' }); })).toThrow('names site twice');
    expect(shape((c) => { c.sources['builtin/y.c'] = ['cmd_x']; })).toThrow('lists cmd_x twice');
    expect(shape((c) => { c.waived = { helper: '' }; })).toThrow('waives helper without a reason');
  });

  it('accepts only declared exclusions for the kinds they cover', () => {
    const exclude = (kind, exclusion) => (c) => {
      const index = c.obligations.findIndex((o) => o.kind === kind);
      c.obligations[index] = { ...c.obligations[index], disposition: 'excluded', exclusion };
    };
    expect(shape(exclude('platform', 'other-git-versions'))).not.toThrow();
    expect(shape(exclude('values', 'other-git-versions'))).toThrow('does not cover values');
    expect(shape(exclude('platform', 'toString'))).toThrow('declared exclusion');
    expect(shape(exclude('platform', '__proto__'))).toThrow('declared exclusion');
  });

  it('compares closures with the pinned refusal-site snapshot', () => {
    const snapshot = {
      files: {
        'builtin/x.c': {
          sha256: 'abc',
          functions: {
            cmd_x: { sites: [{ call: 'die', text: 'bad mode', line: 3 }], references: ['helper'] },
          },
        },
      },
    };
    const pinned = new Map([['builtin/x.c', 'abc']]);
    const c = closure();
    expect(closureSourceProblems(c, snapshot, pinned)).toEqual([
      'cmd_x references helper, which is neither listed nor waived',
    ]);
    c.waived = { helper: 'only formats output' };
    expect(closureSourceProblems(c, snapshot, pinned)).toEqual([]);
    c.obligations[0].sites = ['cmd_x: invented'];
    expect(closureSourceProblems(c, snapshot, new Map())).toEqual([
      'builtin/x.c does not match a pinned source fingerprint',
      'site not covered: cmd_x: bad mode',
      'site not in the source: cmd_x: invented',
    ]);
    // A same-named function listed for another file does not close a same-file reference.
    const other = closure();
    other.sources['builtin/y.c'] = ['helper'];
    const twoFiles = {
      files: { ...snapshot.files, 'builtin/y.c': { sha256: 'def', functions: { helper: { sites: [], references: [] } } } },
    };
    expect(closureSourceProblems(other, twoFiles, new Map([...pinned, ['builtin/y.c', 'def']]))).toEqual([
      'cmd_x references helper, which is neither listed nor waived',
    ]);
    c.sources = { 'builtin/nonexistent.c': ['cmd_x'] };
    expect(closureSourceProblems(c, snapshot, pinned)).toContain('builtin/nonexistent.c is not in the refusal-site snapshot');
  });
});

describe('refusal site extraction', () => {
  const source = `
static int helper(int x)
{
\tif (x) /* die("in a comment") */
\t\treturn error(_("bad %s"), "--flag");
\tputs("internal error (oops)");
\treturn 0;
}

static int
knr(int copy)
{
\tdie(copy ? _("cannot copy \\"%s\\"") : _("cannot rename"));
\tdie((copy ? _("a") : _("b")));
}

int cmd_x(int argc, const char **argv)
{
\tshow_usage_with_options_if_asked(argc, argv, usage, options);
\tif (argc > 2)
\t\tdie(_("options '%s' and '%s' cannot be used together"), "-a", "-b");
\tdie_for_incompatible_opt3(a, "-a", b, "-b", c, "-c");
\tif (argc)
\t\tusage_with_options(usage, options);
\tBUG("not a refusal");
\tdie_errno(_("could not read '%s'"), path);
\terror(msg);
\tif (argc > 9)
\t\texit(1);
\tparse(options, callback_fn);
\treturn helper(argc) + knr(0);
}

static int callback_fn(void) { return 0; }
`;

  it('lists refusal calls of the named function only, in source order', () => {
    expect(refusalSites(source, 'cmd_x').map(siteLabel)).toEqual([
      'cmd_x: show_usage_with_options_if_asked',
      "cmd_x: options '%s' and '%s' cannot be used together [-a, -b]",
      'cmd_x: -a / -b / -c',
      'cmd_x: usage_with_options',
      "cmd_x: could not read '%s'",
      'cmd_x: <msg>',
      'cmd_x: exit 1',
    ]);
  });

  it('skips comments and calls spelled inside string literals', () => {
    expect(refusalSites(source, 'helper').map(siteLabel)).toEqual(['helper: bad %s [--flag]']);
  });

  it('splits conditional messages and finds definitions whose name starts a line', () => {
    expect(refusalSites(source, 'knr').map(siteLabel)).toEqual([
      'knr: cannot copy "%s"',
      'knr: cannot rename',
      'knr: a',
      'knr: b',
    ]);
  });

  it('reports the original line of each site', () => {
    expect(refusalSites(source, 'helper')[0].line).toBe(5);
  });

  it('lists same-file functions a function calls or references', () => {
    expect(referencedFunctions(source, 'cmd_x')).toEqual(['callback_fn', 'helper', 'knr']);
  });

  it('refuses a missing function', () => {
    expect(() => refusalSites(source, 'cmd_missing')).toThrow('expected one definition, found 0');
  });
});
