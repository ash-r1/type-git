import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('upload-pack', [['--advertise-refs'], { operand: 'repo' }]);
git.command('receive-pack', [['--stateless-rpc'], ['--advertise-refs'], { operand: 'repo' }]);
// @ts-expect-error Server directory is required.
git.command('upload-pack', []);
// @ts-expect-error Exactly one server directory.
git.command('receive-pack', [{ operand: 'repo' }, { operand: 'extra' }]);
git.command('fetch-pack', [['--depth', 'nonsense'], ['--diag-url'], { operand: 'repo' }]);
// @ts-expect-error The manual fetch parser does not recognize automatic negations.
git.command('fetch-pack', [['--no-thin'], { operand: 'repo' }]);
// @ts-expect-error Fetch options precede the destination.
git.command('fetch-pack', [{ operand: 'repo' }, ['--quiet']]);
git.command('send-pack', [['--dry-run'], ['--all'], { operand: 'repo' }]);
// @ts-expect-error All and mirror conflict.
git.command('send-pack', [['--all'], ['--mirror'], { operand: 'repo' }]);
// @ts-expect-error Mirror does not accept explicit refspecs.
git.command('send-pack', [['--mirror'], { operand: 'repo' }, { operand: 'HEAD' }]);
git.command('remote-ext', [{ operand: '--literal-name' }, { operand: 'true' }]);
git.command('remote-fd', [{ operand: 'origin' }, { operand: '0,1' }]);
// @ts-expect-error Helpers require a name and URL.
git.command('remote-fd', [{ operand: 'origin' }]);

// @ts-expect-error Native timeout overflow is rejected before later valid values.
git.command('upload-pack', [['--timeout', 2147483648], ['--timeout', 0], { operand: 'repo' }]);
// @ts-expect-error Native timeout underflow is rejected before later valid values.
git.command('upload-pack', [['--timeout', -2147483649], ['--timeout', 0], { operand: 'repo' }]);
git.command('upload-pack', [['--timeout', 2147483647], ['--timeout', 0], { operand: 'repo' }]);
git.command('upload-pack', [['--timeout', -2147483648], ['--timeout', 0], { operand: 'repo' }]);
git.command('receive-pack', [['--advertise-refs'], { operand: 'repo' }], { stdout: 'bytes' }).then((result) => { result.stdout satisfies Uint8Array; });
