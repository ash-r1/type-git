import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Read the hidden command registration synthesized by LFS's pinned dependency. */
export async function cobraCompletion(lfsRoot, cobraRoot) {
  if (!cobraRoot) throw new Error('Supply the Cobra 1.10.2 source directory as the final source argument');
  const goMod = await readFile(join(lfsRoot, 'go.mod'), 'utf8');
  if (!/github\.com\/spf13\/cobra\s+v1\.10\.2(?:\s|$)/.test(goMod)) throw new Error('Expected Git LFS dependency Cobra 1.10.2');
  const source = await readFile(join(cobraRoot, 'completions.go'), 'utf8');
  const names = ['ShellCompRequestCmd', 'ShellCompNoDescRequestCmd'].map(name => {
    const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"`).exec(source);
    if (!match) throw new Error(`Missing Cobra completion constant ${name}`);
    return match[1];
  });
  const registration = source.split('func (c *Command) initCompleteCmd(')[1]?.split('Run:')[0];
  const use = registration?.match(/Use:\s*fmt\.Sprintf\("%s \[command-line\]",\s*ShellCompRequestCmd\)/);
  const minimum = registration?.match(/Args:\s*MinimumNArgs\((\d+)\)/);
  if (!minimum || !use || !/Hidden:\s*true/.test(registration) || !/DisableFlagParsing:\s*true/.test(registration) || !/Aliases:\s*\[\]string\{ShellCompNoDescRequestCmd\}/.test(registration)) {
    throw new Error('Review changed Cobra completion registration grammar');
  }
  return {
    version: '1.10.2', names, minimum: Number(minimum[1]),
    source: 'https://github.com/spf13/cobra/blob/v1.10.2/completions.go',
    sources: {
      'lfs/go.mod': createHash('sha256').update(goMod).digest('hex'),
      'cobra/completions.go': createHash('sha256').update(source).digest('hex'),
    },
  };
}
