// Shared native oracle setup; independent of the production command parser.
import { spawnSync } from 'node:child_process';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';
import { openSync, closeSync } from 'node:fs';
import { join } from 'node:path';

/** Isolate inherited Git state and provide deterministic identity, locale and dates. */
export function oracleEnv(directory) {
  return { ...nativeOracleBaseEnv(), HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', GIT_TEST_DISALLOW_ABBREVIATED_OPTIONS: 'false', LC_ALL: 'C', GIT_PAGER: 'cat', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test', GIT_EDITOR: 'true', GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z' };
}

/** Run native Git with file-backed LF/NUL stdin and reject abnormal termination. */
export function gitRunner(directory, env) {
  return function git(args) {
    const input = openSync(join(directory, args.includes('--pathspec-file-nul') ? 'oracle-input-nul' : 'oracle-input'), 'r');
    try {
      const result = spawnSync('git', args, { cwd: directory, env, stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000 });
      if (result.error || result.signal) throw result.error ?? new Error(`Git terminated: ${result.signal}`);
      return result;
    } finally { closeSync(input); }
  };
}

/** Spell API tokens independently, including the optional attached -t value. */
export const serialize = tokens => tokens.flatMap(token => !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : token[0] === '-t' ? [`${token[0]}${token[1]}`] : token[0].startsWith('--') ? [`${token[0]}=${token[1]}`] : token);
