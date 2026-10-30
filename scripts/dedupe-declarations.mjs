// tsup's dts build writes every shared declaration chunk twice: once as ESM
// (`*.d.ts`) and once as CJS (`*.d.cts`). The chunks hold only types, so a
// single CommonJS copy can serve both: ESM declarations may import a CJS
// declaration file, but CJS declarations may not import an ESM one under
// node16. Keep each `.d.cts` chunk, drop its `.d.ts` twin, and point the ESM
// entry declarations at the `.cjs` specifier. Entry declarations (the `types`
// targets in package.json `exports`) keep both formats.
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\.js\2/g;

function typesTargets(exports, root) {
  const found = new Set();
  const visit = (value, key) => {
    if (typeof value === 'string') {
      if (key === 'types') found.add(resolve(root, value));
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) visit(v, k);
    }
  };
  visit(exports, '');
  return found;
}

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

const esmToCjs = (text) => text.replace(SPECIFIER, '$1$2$3.cjs$2');

export async function dedupeDeclarations(root, outDir = 'dist') {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const entries = typesTargets(pkg.exports, root);
  const files = await walk(resolve(root, outDir));
  const esm = files.filter((file) => file.endsWith('.d.ts'));
  const removed = new Set();
  for (const file of esm) {
    if (entries.has(file)) continue;
    const twin = `${file.slice(0, -'.d.ts'.length)}.d.cts`;
    if (!files.includes(twin)) continue;
    const [esmText, cjsText] = await Promise.all([readFile(file, 'utf8'), readFile(twin, 'utf8')]);
    if (esmToCjs(esmText) !== cjsText) {
      throw new Error(`Declaration chunks differ beyond specifiers: ${relative(root, file)}`);
    }
    removed.add(file);
  }
  const rewrite = (from) => (match, lead, quote, spec) => {
    const target = resolve(dirname(from), `${spec.split('/').join(sep)}.d.ts`);
    return removed.has(target) ? `${lead}${quote}${spec}.cjs${quote}` : match;
  };
  for (const file of esm) {
    if (removed.has(file)) continue;
    const text = await readFile(file, 'utf8');
    const next = text.replace(SPECIFIER, rewrite(file));
    if (next !== text) await writeFile(file, next);
  }
  await Promise.all([...removed].map((file) => rm(file)));
  return [...removed].map((file) => relative(root, file));
}
