import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('submodule', []);
git.command('submodule update', [['--init'], ['--filter', 'blob:none']]);
git.command('submodule update', [['--require-init'], ['--filter', 'blob:none']]);
git.command('submodule--helper update', [['--require-init'], ['--no-init'], ['--filter', 'blob:none']]);
// @ts-expect-error The shell frontend does not recognize helper negations.
git.command('submodule update', [['--no-init']]);
// @ts-expect-error Filters require initialization.
git.command('submodule update', [['--filter', 'blob:none']]);
// @ts-expect-error The shell foreach parser rejects a separator.
git.command('submodule foreach', [['--'], { operand: 'true' }]);
git.command('submodule--helper foreach', [['--'], { operand: 'true' }]);
git.command('submodule deinit', [['--all']]);
// @ts-expect-error Deinit needs explicit paths or all.
git.command('submodule deinit', []);
// @ts-expect-error Explicit branches and defaults conflict, including empty values.
git.command('submodule set-branch', [['--branch', ''], ['--default'], { operand: 'module' }]);
// @ts-expect-error Separate short branch values cannot be empty in the shell frontend.
git.command('submodule set-branch', [['-b', ''], { operand: 'module' }]);
git.command('submodule summary', [['--cached'], ['--files'], ['--summary-limit', 0]]);
// @ts-expect-error Without the early zero limit return, the input modes conflict.
git.command('submodule summary', [['--cached'], ['--files']]);
// @ts-expect-error Clone requires a URL and nonempty destination.
git.command('submodule--helper clone', []);
git.command('submodule--helper gitdir', [{ operand: 'module' }]);
git.command('submodule--helper push-check', [{ operand: 'HEAD' }, { operand: 'origin' }]);
git.command('submodule--helper migrate-gitdir-configs', [{ operand: 'ignored' }]);
git.command('sparse-checkout list', [{ operand: 'ignored' }]);
git.command('sparse-checkout set', [['--stdin'], { operand: 'ignored' }]);
git.command('sparse-checkout clean', []);
// @ts-expect-error The root dispatcher requires an operation.
git.command('sparse-checkout', []);
// @ts-expect-error Leading cached is limited to status and summary.
git.command('submodule', [['--cached'], { operand: 'update' }]);
// @ts-expect-error The shell forwards -i, which the native helper rejects.
git.command('submodule update', [['-i']]);
git.command('submodule update', [['-i'], ['--init']]);
// @ts-expect-error A later short spelling replaces the valid long spelling.
git.command('submodule update', [['--init'], ['-i']]);
