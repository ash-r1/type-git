// The completion criterion for one audit scope in spec/command-audit.json.
//
// A finite native corpus never shows that a scope is exhaustively modeled, so "complete"
// does not rest on case counts. It rests on a closure: an explicit list of obligations,
// derived from the pinned Git source, in which nothing is left open. See
// docs/design/audit-completion.md for the definition; this module is its executable form,
// shared by command-coverage.mjs (which enforces it) and command-progress.mjs (which
// reports what is missing).

/** Every obligation is closed by one of the first three; "open" keeps the scope partial. */
export const DISPOSITIONS = ['modeled', 'delegated', 'excluded', 'open'];
/**
 * Obligation kinds a closure must address beyond its enumerated refusal sites. Each needs
 * at least one obligation, so a closure cannot be written by listing die() calls alone.
 */
export const REQUIRED_KINDS = ['parser', 'values', 'operands', 'state', 'platform'];
export const KINDS = ['refusal', ...REQUIRED_KINDS];
/**
 * What a delegated obligation depends on. Delegation means native Git decides at runtime
 * from input that the argv alone does not determine; the basis names that input.
 */
export const DELEGATION_BASES = [
  'configuration',
  'repository-state',
  'object-resolution',
  'filesystem',
  'environment',
  'terminal',
  'file-content',
  'platform',
];
/** Facets that every typed scope has; only operands and combinations can be absent. */
export const WAIVABLE_FACETS = ['operand-grammar', 'combination-rules'];
/** Evidence is a checked-in file under one of these directories. */
const EVIDENCE = /^(?:test|scripts|src|docs)\/[\w./-]+$/;

/** Printable identity of an extracted refusal site, as closures reference it. */
export const siteLabel = (site) => `${site.function}: ${site.text ?? site.call}`;

const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isTextList = (value) => Array.isArray(value) && value.length > 0 && value.every(isText);

/**
 * Validate the shape of a closure and throw on malformed records. Shape errors are bugs in
 * the ledger, not open work, so they fail the build instead of showing up as gaps.
 */
export function checkClosureShape(scope, closure, exclusions) {
  const fail = (message) => {
    throw new Error(`${scope}: closure ${message}`);
  };
  if (!isText(closure.git)) fail('names no Git version');
  if (!closure.sources || typeof closure.sources !== 'object' || !Object.keys(closure.sources).length) {
    fail('names no audited source');
  }
  const functions = new Set();
  for (const [file, names] of Object.entries(closure.sources)) {
    if (!isTextList(names)) fail(`lists no functions for ${file}`);
    for (const name of names) {
      // Site labels carry the function name only, so it must identify one definition.
      if (functions.has(name)) fail(`lists ${name} twice`);
      functions.add(name);
    }
  }
  if (!isText(closure.entry) || !functions.has(closure.entry)) fail('does not list its entry point');
  for (const [name, reason] of Object.entries(closure.waived ?? {})) {
    if (!isText(reason)) fail(`waives ${name} without a reason`);
    if (functions.has(name)) fail(`both lists and waives ${name}`);
  }
  if (!Array.isArray(closure.obligations) || !closure.obligations.length) fail('has no obligations');
  const ids = new Set();
  const sites = new Set();
  for (const o of closure.obligations) {
    if (!isText(o.id) || ids.has(o.id)) fail(`has a missing or duplicate id ${o.id}`);
    ids.add(o.id);
    if (!KINDS.includes(o.kind)) fail(`${o.id}: unknown kind ${o.kind}`);
    if (!DISPOSITIONS.includes(o.disposition)) fail(`${o.id}: unknown disposition ${o.disposition}`);
    if (!isText(o.summary)) fail(`${o.id}: no summary`);
    if (o.kind === 'refusal') {
      if (!isTextList(o.sites)) fail(`${o.id}: refusal obligation names no site`);
      // A refusal Git makes is either typed or left to Git; it is never out of scope.
      if (o.disposition === 'excluded') fail(`${o.id}: a refusal site cannot be excluded`);
    } else if (o.sites !== undefined) fail(`${o.id}: only refusal obligations name sites`);
    for (const site of o.sites ?? []) {
      if (sites.has(site)) fail(`names site twice: ${site}`);
      sites.add(site);
    }
    if (o.disposition === 'modeled') {
      if (!isTextList(o.evidence)) fail(`${o.id}: modeled without evidence`);
      for (const file of o.evidence) if (!EVIDENCE.test(file) || file.includes('..')) fail(`${o.id}: evidence ${file} is not a repository file`);
    }
    if (o.disposition === 'delegated') {
      if (!isText(o.reason)) fail(`${o.id}: delegated without a reason`);
      if (!DELEGATION_BASES.includes(o.basis)) fail(`${o.id}: delegated without a basis (${o.basis})`);
    }
    if (o.disposition === 'open' && !isText(o.reason)) fail(`${o.id}: open without a reason`);
    if (o.disposition === 'excluded') {
      if (!Object.hasOwn(exclusions, o.exclusion ?? '')) fail(`${o.id}: excluded without a declared exclusion (${o.exclusion})`);
      if (!exclusions[o.exclusion].kinds.includes(o.kind)) fail(`${o.id}: exclusion ${o.exclusion} does not cover ${o.kind}`);
    }
  }
  if (!closure.obligations.some((o) => o.disposition === 'modeled')) fail('models nothing');
}

/**
 * Compare a closure with the refusal-site snapshot extracted from the pinned source.
 * Returns problems as strings; an empty list means the closure names exactly the sites
 * and same-file references of the functions it lists.
 */
export function closureSourceProblems(closure, snapshot, pinned) {
  const problems = [];
  const named = new Set(closure.obligations.flatMap((o) => o.sites ?? []));
  const found = new Set();
  const listed = new Set(Object.values(closure.sources).flat());
  for (const [file, names] of Object.entries(closure.sources)) {
    const record = snapshot.files[file];
    if (!record) {
      problems.push(`${file} is not in the refusal-site snapshot`);
      continue;
    }
    if (pinned.get(file) !== record.sha256) problems.push(`${file} does not match a pinned source fingerprint`);
    for (const name of names) {
      const fn = record.functions[name];
      if (!fn) {
        problems.push(`${file}:${name} is not in the refusal-site snapshot`);
        continue;
      }
      for (const site of fn.sites) found.add(siteLabel({ function: name, ...site }));
      for (const ref of fn.references) {
        if (!listed.has(ref) && !Object.hasOwn(closure.waived ?? {}, ref)) {
          problems.push(`${name} references ${ref}, which is neither listed nor waived`);
        }
      }
    }
  }
  for (const site of found) if (!named.has(site)) problems.push(`site not covered: ${site}`);
  for (const site of named) if (!found.has(site)) problems.push(`site not in the source: ${site}`);
  return problems;
}

/**
 * What still keeps a scope from "complete", as short machine-readable gap labels. An empty
 * list means every criterion holds and the scope must be recorded as complete.
 */
export function completionGaps(record, { facets, baseline }) {
  const gaps = [];
  const inapplicable = record.inapplicableFacets ?? {};
  for (const facet of facets) {
    if (record.evidence?.[facet]?.length) continue;
    if (WAIVABLE_FACETS.includes(facet) && isText(inapplicable[facet])) continue;
    gaps.push(`facet:${facet}`);
  }
  const closure = record.closure;
  if (!closure) gaps.push('closure');
  else {
    if (closure.git !== baseline) gaps.push('closure-baseline');
    const obligations = Array.isArray(closure.obligations) ? closure.obligations : [];
    const kinds = new Set(obligations.map((o) => o.kind));
    for (const kind of REQUIRED_KINDS) if (!kinds.has(kind)) gaps.push(`kind:${kind}`);
    for (const o of obligations) if (o.disposition === 'open') gaps.push(`open:${o.id}`);
  }
  if (record.remaining) gaps.push('unclassified-remaining');
  return gaps;
}
