import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('help', [['--all'], ['--no-aliases'], ['--no-external-commands']]);
git.command('help', [['--guides'], ['--man'], ['--no-man']]);
// @ts-expect-error Listing modes exclude explicit document operands.
git.command('help', [['--guides'], { operand: 'git' }]);
// @ts-expect-error Modes conflict immediately.
git.command('help', [['--guides'], ['--all']]);
// @ts-expect-error An explicit negative selector still requires all.
git.command('help', [['--no-aliases']]);
// @ts-expect-error Listing modes do not launch viewers.
git.command('help', [['--guides'], ['--web']]);
git.command('daemon', [['--serve'], ['--export-all'], ['--max-connections', -1]]);
// @ts-expect-error Inetd cannot detach.
git.command('daemon', [['--inetd'], ['--detach']]);
// @ts-expect-error An empty explicit group still requires a user.
git.command('daemon', [['--group', '']]);
// @ts-expect-error Strict paths needs at least one directory.
git.command('daemon', [['--strict-paths']]);
git.command('fsmonitor--daemon', [{ operand: 'status' }]);
git.command('fsmonitor--daemon run', [['--ipc-threads', 2], ['--start-timeout', -1]]);
// @ts-expect-error The root requires an operation.
git.command('fsmonitor--daemon', []);
// @ts-expect-error Fixed operations do not accept extra operands.
git.command('fsmonitor--daemon status', [{ operand: 'extra' }]);

git.command('daemon', [['--serve'], ['--timeout', 4294967295]]);
// Older daemon atoi assigns the narrowed value into unsigned32 storage.
git.command('daemon', [['--serve'], ['--timeout', 4294967296], ['--timeout', 1]]);
git.command('daemon', [['--serve'], ['--init-timeout', 4294967295]]);
// Older daemon atoi assigns the narrowed value into unsigned32 storage.
git.command('daemon', [['--serve'], ['--init-timeout', 4294967296], ['--init-timeout', 1]]);
git.command('daemon', [['--serve'], ['--max-connections', -2147483648]]);
// Older daemon atoi accepts overflowing incoming values before replacement.
git.command('daemon', [['--serve'], ['--max-connections', 2147483648], ['--max-connections', 1]]);
// Older daemon atoi accepts this lower-bound overflow before replacement.
git.command('daemon', [['--serve'], ['--max-connections', -2147483649], ['--max-connections', 1]]);
// Older supported-platform OPTION_INTEGER handlers narrow before overwrite.
git.command('fsmonitor--daemon start', [['--ipc-threads', 2147483648], ['--ipc-threads', 2]]);
// Older supported-platform OPTION_INTEGER handlers narrow before overwrite.
git.command('fsmonitor--daemon start', [['--start-timeout', 2147483648], ['--start-timeout', 2]]);
// Older supported-platform OPTION_INTEGER handlers narrow before overwrite.
git.command('fsmonitor--daemon run', [['--ipc-threads', 2147483648], ['--ipc-threads', 2]]);
// Older supported-platform OPTION_INTEGER handlers narrow before overwrite.
git.command('fsmonitor--daemon run', [['--start-timeout', 2147483648], ['--start-timeout', 2]]);
// Older supported-platform OPTION_INTEGER handlers narrow before overwrite.
git.command('fsmonitor--daemon stop', [['--ipc-threads', 2147483648], ['--ipc-threads', 2]]);
// Older supported-platform OPTION_INTEGER handlers narrow before overwrite.
git.command('fsmonitor--daemon stop', [['--start-timeout', 2147483648], ['--start-timeout', 2]]);
// Older supported-platform OPTION_INTEGER handlers narrow before overwrite.
git.command('fsmonitor--daemon status', [['--ipc-threads', 2147483648], ['--ipc-threads', 2]]);
// Older supported-platform OPTION_INTEGER handlers narrow before overwrite.
git.command('fsmonitor--daemon status', [['--start-timeout', 2147483648], ['--start-timeout', 2]]);
git.command('fsmonitor--daemon status', [['--ipc-threads', 0], ['--ipc-threads', 2]]);
