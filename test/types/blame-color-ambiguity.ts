import type { Git } from '../../src/index.js';
declare const blameColorGit: Git;
declare const blameColorUnion: '--color' | '--color-lines';
for (const command of ['blame', 'annotate', 'pickaxe'] as const) {
  blameColorGit.command(command, [['--color-lines'], ['-h']]);
  blameColorGit.command(command, [['-h'], ['--color', 'invalid']]);
  blameColorGit.command(command, [['-h'], ['--color']]);
  blameColorGit.command(command, [['-h'], [blameColorUnion]]);
  // @ts-expect-error The ambiguous spelling is rejected when reached, even without a value.
  blameColorGit.command(command, [['--color'], ['-h']]);
  // @ts-expect-error A valid enum value cannot disambiguate an option name.
  blameColorGit.command(command, [['--color', 'always'], ['-h']]);
  // @ts-expect-error Every possible reached flag arm must be valid.
  blameColorGit.command(command, [[blameColorUnion], ['-h']]);
  // @ts-expect-error NUL remains invalid after help.
  blameColorGit.command(command, [['-h'], ['--color', '\0']]);
  // @ts-expect-error An ignored optional string still requires a string representation.
  blameColorGit.command(command, [['-h'], ['--color', 42]]);
}
