import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

test('native config queries ignore inherited config injection and tracing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'type-git-oracle-config-'));
  try {
    const config = join(directory, 'config');
    writeFileSync(config, '');
    const inherited = { ...process.env, GIT_CONFIG: config, GIT_CONFIG_PARAMETERS: 'invalid', GIT_CONFIG_COUNT: 'invalid', GIT_TRACE: '1' };
    const args = ['-c', 'oracle.value=true', 'config', '--type=bool', '--get', 'oracle.value'];
    const control = spawnSync('git', args, { cwd: directory, env: inherited, encoding: 'utf8' });
    assert.notEqual(control.status, 0);
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8', env: {
      ...nativeOracleBaseEnv(inherited), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: config, GIT_CONFIG_COUNT: '0', LC_ALL: 'C',
    } });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'true\n');
    assert.equal(result.stderr, '');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('repository discovery stays in the oracle cwd despite inherited repository paths', () => {
  const directory = mkdtempSync(join(tmpdir(), 'type-git-oracle-repositories-'));
  try {
    const env = { ...nativeOracleBaseEnv(), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(directory, 'empty'), GIT_CONFIG_COUNT: '0' };
    writeFileSync(env.GIT_CONFIG_GLOBAL, '');
    const left = join(directory, 'left');
    const right = join(directory, 'right');
    for (const cwd of [left, right]) {
      mkdirSync(cwd);
      const result = spawnSync('git', ['init', '-q'], { cwd, env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const args = ['rev-parse', '--absolute-git-dir'];
    const baseline = spawnSync('git', args, { cwd: right, env, encoding: 'utf8' });
    assert.equal(baseline.status, 0, baseline.stderr);
    const inherited = { ...env, GIT_DIR: join(left, '.git'), GIT_WORK_TREE: left };
    const control = spawnSync('git', args, { cwd: right, env: inherited, encoding: 'utf8' });
    assert.equal(control.status, 0, control.stderr);
    assert.notEqual(control.stdout, baseline.stdout);
    const actual = spawnSync('git', args, { cwd: right, env: { ...nativeOracleBaseEnv(inherited), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: env.GIT_CONFIG_GLOBAL, GIT_CONFIG_COUNT: '0' }, encoding: 'utf8' });
    assert.equal(actual.status, baseline.status, actual.stderr);
    assert.equal(actual.stdout, baseline.stdout);
    assert.equal(actual.stderr, baseline.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
