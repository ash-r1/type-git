import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';
const valid = [
  'blob:none',
  'blob:limit=0',
  'blob:limit=+10K',
  'blob:limit= 0x10m',
  'blob:limit=077',
  'blob:limit=0b10',
  'blob:limit=18446744073709551615',
  'tree:0',
  'tree:+2g',
  'sparse:oid=',
  'sparse:oid=HEAD:path with spaces',
  'object:type=commit',
  'object:type=tree',
  'object:type=blob',
  'object:type=tag',
  'combine:+',
  'combine:++',
  'combine:blob:none+',
  'combine:+blob:none++tree:1',
  'combine:blob:limit=1k+tree:2',
  'combine:combine:blob:none%2Btree:1',
  'combine:sparse:oid=%00',
  'combine:sparse:oid=%xx',
  'combine:sparse:oid=%ff',
  'combine:sparse:oid=a%20b',
  'combine:sparse:oid=%2520',
];
const invalid = [
  '',
  'blob:None',
  'BLOB:none',
  'blob:limit=',
  'blob:limit=-1',
  'blob:limit=08',
  'blob:limit=1kb',
  'blob:limit=1 ',
  'blob:limit=18446744073709551616',
  'blob:limit=17179869184g',
  'tree:',
  'tree:1.2',
  'tree:-0',
  'tree:0x',
  'object:type=',
  'object:type=delta',
  'object:type=Blob',
  'sparse:path=path',
  'combine:',
  'combine:auto',
  'combine:blob:none+auto',
  'combine:tree: 1',
  'combine:sparse:oid=a~b',
  'combine:combine:tree:1%2Bauto',
  'combine:unknown%xx',
];
const tokens = (values: readonly (string | null)[]) =>
  values.map((value) => (value === null ? ['--no-filter'] : ['--filter', value]));

// Every direct parse-options table using opt_parse_list_objects_filter, plus the manual revision parser.
const scopes: GitCommandName[] = [
  'clone',
  'fetch',
  'cat-file',
  'pack-objects',
  'repack',
  'submodule--helper clone',
  'submodule--helper update',
  'rev-list',
  'fetch-pack',
];

describe.skipIf(legacy)('Git 2.55 object-filter callbacks', () => {
  let root: string;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-filters-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'config'),
      GIT_TERMINAL_PROMPT: '0',
    };
    expect(spawnSync('git', ['init', root], { env }).status).toBe(0);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function compare(
    command: GitCommandName,
    values: readonly (string | null)[],
    accepted?: boolean,
  ) {
    const prefix = command === 'rev-list' ? ['--objects'] : [];
    const args = [
      ...command.split(' '),
      ...prefix,
      ...values.map((value) => (value === null ? '--no-filter' : `--filter=${value}`)),
      '-h',
    ];
    const native = spawnSync('git', ['-C', root, ...args], {
      env,
      encoding: 'utf8',
      timeout: 5000,
    });
    expect(native.error, JSON.stringify(args)).toBeUndefined();
    const diagnostic = native.stderr + native.stdout;
    const actual = native.status === 129 && diagnostic.includes('usage:');
    if (accepted !== undefined) {
      expect(actual, `${args.join(' ')}\n${diagnostic}`).toBe(accepted);
    }
    if (!actual) {
      expect(native.status, diagnostic).toBe(128);
      expect(diagnostic).toContain('fatal:');
    }
    const build = () =>
      commandArguments(command, [...prefix.map((flag) => [flag]), ...tokens(values), ['-h']], true);
    if (actual) {
      expect(build, args.join(' ')).not.toThrow();
    } else {
      expect(build, args.join(' ')).toThrow(GitArgumentError);
    }
  }

  it.each(scopes)('matches the independent lexical corpus in %s', (command) => {
    for (const value of valid) {
      compare(command, [value], true);
    }
    for (const value of invalid) {
      compare(command, [value], false);
    }
    compare(command, ['auto'], command === 'clone' || command === 'fetch');
    // A later overwrite or reset cannot rescue a callback failure.
    compare(command, ['BAD', null, 'blob:none'], false);
  });

  it.each([
    'clone',
    'fetch',
  ] as const)('exhausts all filter/reset sequences of length up to four in %s', (command) => {
    const alphabet = ['blob:none', 'combine:blob:none+tree:1', 'auto', null];
    let frontier: (string | null)[][] = [[]];
    for (let depth = 0; depth < 4; depth++) {
      frontier = frontier.flatMap((prefix) => alphabet.map((value) => [...prefix, value]));
      for (const sequence of frontier) {
        compare(command, sequence);
      }
    }
    compare(command, ['blob:none', 'tree:1', null, 'auto'], false);
    compare(command, ['combine:blob:none', 'tree:1', null, 'auto'], true);
    compare(command, ['blob:none', null, 'tree:1', null, 'auto'], true);
  }, 30000);
});
