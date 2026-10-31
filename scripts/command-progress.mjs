// Per-command progress report over the audit ledger and its derived evidence.
//
// command-coverage.mjs checks ledger consistency for every scope; this script
// answers "how far along is <command> and what is left" for a chosen set of
// commands, one section per facet. Everything is derived from checked-in data:
//
//   target versions   pinned upstream baseline plus the Git versions named by the
//                     native corpora that contain cases for the command
//   argument rules    generated typed CLI schema (rules, transitions, parser exit
//                     model) and any finite constraint-exploration model
//   native comparison case counts per independent native corpus fixture
//   compiler tests    test/types files recorded in the audit ledger
//   legacy profiles   runtime test files that branch on the legacy Git job
//   achieved          ledger sentences describing modeled behavior
//   delegation        ledger sentences describing work deferred to runtime or Git
//   remaining         ledger sentences describing open obligations
//
// The achieved/delegation/remaining split classifies the ledger's free text by keyword;
// the ledger record itself stays authoritative. Run without arguments for the
// priority groups, or pass command names (a name also selects its "name *"
// operation scopes). --json prints the same data as JSON.
import { readdir, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

export const GROUPS = {
  core: ['status', 'diff', 'log', 'show', 'add', 'commit', 'switch', 'restore', 'branch'],
  next: ['clone', 'fetch', 'pull', 'push', 'merge', 'rebase', 'reset', 'stash'],
};

const DELEGATION = /delegat|defer|\bat runtime\b|runtime (?:check|validation)|native Git (?:determines|decides|reports)|opaque|dynamic/i;
const REMAINING = /remain|require|pending|not (?:yet )?(?:modeled|audited|establish)|separate (?:audit|work)|obligation|further audit|unsupported|completeness/i;
const VERSION = /Git ?(\d+\.\d+(?:\.\d+)?)/g;
const LEGACY = /TYPE_GIT_USE_LEGACY_VERSION|Git 2\.25/;

// "Git 2.55" next to "Git 2.55.0" names the same release.
const releases = (named) => [...new Set(named)].filter((v, _, all) => !all.some((w) => w !== v && w.startsWith(`${v}.`))).sort();
const sentences = (text) => (text ?? '').split(/(?<=[.;])\s+(?=[A-Z0-9`])/).map((s) => s.trim()).filter(Boolean);

async function loadCorpora() {
  const dir = new URL('test/fixtures/', root);
  const corpora = [];
  for (const name of (await readdir(dir)).filter((n) => n.endsWith('.json')).sort()) {
    const data = await json(`test/fixtures/${name}`);
    if (!Array.isArray(data?.cases)) continue;
    const profile = String(data.profile ?? data.scope ?? data.source ?? '');
    const counts = new Map();
    for (const row of data.cases) {
      if (typeof row?.command !== 'string') continue;
      const entry = counts.get(row.command) ?? { cases: 0, accepted: 0 };
      entry.cases += 1;
      if (row.valid === true || row.accepted === true) entry.accepted += 1;
      counts.set(row.command, entry);
    }
    if (counts.size) corpora.push({ fixture: `test/fixtures/${name}`, versions: releases([...profile.matchAll(VERSION)].map((m) => m[1])), counts });
  }
  return corpora;
}

export async function commandProgress(requested) {
  const [audit, inventory, cli, exploration, corpora] = await Promise.all([
    json('spec/command-audit.json'),
    json('spec/upstream/command-inventory.json'),
    json('docs/design/command-exploration.json'),
    json('docs/design/constraint-exploration.json'),
    loadCorpora(),
  ]);
  const legacyTests = new Set();
  for (const test of new Set(Object.values(audit.commands).flatMap((r) => r.tests))) {
    if (!test.startsWith('test/types/') && test.endsWith('.ts') && LEGACY.test(await readFile(new URL(test, root), 'utf8'))) legacyTests.add(test);
  }
  const schemas = new Map(cli.commands.map((entry) => [entry.command, entry]));
  const scopesOf = (name) => Object.keys(audit.commands).filter((c) => c === name || c.startsWith(`${name} `)).sort();
  return requested.map((name) => {
    const scopes = scopesOf(name);
    if (!scopes.length) throw new Error(`${name}: no audit record`);
    return {
      command: name,
      scopes: scopes.map((scope) => {
        const record = audit.commands[scope];
        const schema = schemas.get(scope);
        const native = corpora
          .filter((c) => c.counts.has(scope))
          .map((c) => ({ fixture: c.fixture, versions: c.versions, ...c.counts.get(scope) }));
        const text = sentences(record.remaining);
        return {
          scope,
          state: record.state,
          evidence: audit.facets.filter((facet) => record.evidence?.[facet]?.length),
          versions: {
            pinned: inventory.baselines.git,
            native: releases(native.flatMap((n) => n.versions)),
            source: schema?.parserExit?.source ?? null,
            legacyTests: record.tests.filter((t) => legacyTests.has(t)),
          },
          argumentRules: {
            typedCommandAPI: Boolean(record.typedCommandAPI),
            rules: schema?.rules ?? 0,
            transitions: schema?.transitions?.length ?? 0,
            parserExitModel: Boolean(schema?.parserExit),
            unknownOptions: schema?.parserExit?.unknownOptions ?? null,
            finiteModels: exploration
              .filter((m) => m.command === scope || record.models.includes(m.command))
              .map((m) => ({ type: m.type, scope: m.scope ?? 'options', total: m.total, accepted: m.accepted })),
          },
          nativeComparison: { cases: native.reduce((n, c) => n + c.cases, 0), corpora: native },
          compilerTests: record.tests.filter((t) => t.startsWith('test/types/')),
          runtimeTests: record.tests.filter((t) => !t.startsWith('test/types/')),
          achieved: text.filter((s) => !DELEGATION.test(s) && !REMAINING.test(s)),
          delegation: text.filter((s) => DELEGATION.test(s)),
          remaining: text.filter((s) => REMAINING.test(s) && !DELEGATION.test(s)),
        };
      }),
    };
  });
}

function markdown(report, facets) {
  const lines = ['# Command progress', '',
    'Derived from spec/command-audit.json, the generated command schemas and the native corpora in test/fixtures. Delegation and remaining items are keyword-classified ledger sentences; the ledger text is authoritative.', '',
    '| Scope | Audit | Evidence facets | Pinned / native Git | Legacy test files | Rules | Transitions | Parser-exit model | Finite models | Native cases | Runtime / compiler test files |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const { scopes } of report) {
    for (const s of scopes) {
      lines.push(`| \`${s.scope}\` | ${s.state} | ${s.evidence.length}/${facets.length} | ${s.versions.pinned} / ${s.versions.native.join(', ') || '—'} | ${s.versions.legacyTests.length} | ${s.argumentRules.rules} | ${s.argumentRules.transitions} | ${s.argumentRules.parserExitModel ? 'yes' : 'no'} | ${s.argumentRules.finiteModels.length} | ${s.nativeComparison.cases} | ${s.runtimeTests.length} / ${s.compilerTests.length} |`);
    }
  }
  for (const { scopes } of report) {
    for (const s of scopes) {
      lines.push('', `## \`${s.scope}\``, '');
      lines.push(`- Target versions: pinned Git ${s.versions.pinned}; native corpora ${s.versions.native.join(', ') || 'none'}${s.versions.source ? `; parser source ${s.versions.source}` : ''}.`);
      lines.push(`- Legacy-profile runtime tests: ${s.versions.legacyTests.join(', ') || 'none'}.`);
      lines.push(`- Missing evidence facets: ${facets.filter((f) => !s.evidence.includes(f)).join(', ') || 'none'}.`);
      lines.push(`- Native comparison: ${s.nativeComparison.corpora.map((c) => `${c.fixture} ${c.cases} (${c.accepted} accepted)`).join('; ') || 'no corpus cases'}.`);
      lines.push(`- Finite models: ${s.argumentRules.finiteModels.map((m) => `${m.type} ${m.scope} ${m.accepted}/${m.total}`).join('; ') || 'none'}.`);
      lines.push('- Achieved:', ...(s.achieved.length ? s.achieved.map((d) => `  - ${d}`) : ['  - none recorded']));
      lines.push('- Delegation:', ...(s.delegation.length ? s.delegation.map((d) => `  - ${d}`) : ['  - none recorded']));
      lines.push('- Remaining:', ...(s.remaining.length ? s.remaining.map((d) => `  - ${d}`) : ['  - none recorded']));
    }
  }
  return `${lines.join('\n')}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const names = args.filter((a) => a !== '--json').flatMap((a) => GROUPS[a] ?? [a]);
  const report = await commandProgress(names.length ? names : [...GROUPS.core, ...GROUPS.next]);
  const { facets } = await json('spec/command-audit.json');
  process.stdout.write(asJson ? `${JSON.stringify(report, null, 2)}\n` : markdown(report, facets));
}
