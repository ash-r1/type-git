import type { Git } from '../../src/index.js';
declare const git: Git;
declare const dynamic: string;
declare const alternative: 'always' | 'bad';
git.command('grep', [['--color'], ['--help-all']]);
git.command('grep', [['--color', 'always'], ['--help-all']]);
git.command('grep', [['--color', 'AUTO'], ['--help-all']]);
git.command('grep', [['--color', 'never'], ['--help-all']]);
git.command('grep', [['--color', dynamic], ['--help-all']]);
git.command('grep', [['--no-color'], ['--help-all']]);
git.command('grep', [['--help-all'], ['--color', 'bad']]);
// @ts-expect-error A reached shared color callback rejects unknown names.
git.command('grep', [['--color', 'bad'], ['--help-all']]);
// @ts-expect-error Explicit empty text is not the bare optional default.
git.command('grep', [['--color', ''], ['--help-all']]);
// @ts-expect-error Boolean words are not color names for this callback.
git.command('grep', [['--color', 'true'], ['--help-all']]);
// @ts-expect-error Color names are not numeric configuration booleans.
git.command('grep', [['--color', '1'], ['--help-all']]);
// @ts-expect-error ASCII whitespace is not trimmed.
git.command('grep', [['--color', ' always'], ['--help-all']]);
// @ts-expect-error A later valid color cannot repair an earlier callback failure.
git.command('grep', [['--color', 'bad'], ['--color', 'auto'], ['--help-all']]);
// @ts-expect-error Every literal value alternative must be valid.
git.command('grep', [['--color', alternative], ['--help-all']]);
// @ts-expect-error Existing shared-color validation remains in place.
git.command('branch', [['--color', 'bad'], ['--help-all']]);
// @ts-expect-error Public optional strings do not accept explicit booleans.
git.command('grep', [['--color', true], ['--help-all']]);
// @ts-expect-error NUL is rejected even after an early help exit.
git.command('grep', [['--help-all'], ['--color', 'always\0']]);
