import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve('tsup/package.json')), require('tsup/package.json').bin.tsup);
// The complete command catalogue needs more than Node 20's default 2 GiB heap
// during declaration serialization. Keep an explicit caller override if supplied.
const env = { ...process.env };
if (!/--max[-_]old[-_]space[-_]size(?:=|\s)/.test(env.NODE_OPTIONS ?? '')) {
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --max-old-space-size=4096`.trim();
}
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit', env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
