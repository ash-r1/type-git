import type { Constraint } from './model.js';

/** Constraints involving operands as well as options. Keys refer to normalized call input. */
export const INPUT_CONSTRAINTS = {
  lfsCheckout: [
    {
      id: 'lfsCheckout.conflict-path',
      kind: 'arity',
      key: 'patterns',
      min: 1,
      max: 1,
      when: { key: 'to', test: 'nonempty' },
      origin: 'git',
      reason: 'Conflict checkout requires exactly one object path.',
      source: 'https://github.com/git-lfs/git-lfs/blob/v3.8.0/commands/command_checkout.go',
    },
  ],
  pathspec: [
    {
      id: 'pathspec.file-operands',
      kind: 'arity',
      key: 'paths',
      min: 0,
      max: 0,
      // The convenience APIs emit --pathspec-from-file only for a non-empty value.
      when: { key: 'pathspecFromFile', test: 'nonempty' },
      origin: 'git',
      reason: 'Pathspec files cannot be combined with command-line pathspecs.',
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/add.c',
    },
    {
      id: 'pathspec.empty-pathspec',
      kind: 'forbid',
      when: [{ key: 'paths', test: 'includes', valueKey: 'emptyPathspec' }],
      origin: 'git',
      reason:
        'parse_pathspec rejects an empty pathspec; add, rm, path checkout and restore all pass their paths to it.',
      source: 'https://github.com/git/git/blob/v2.55.0/pathspec.c#L638-L642',
    },
  ],
} as const satisfies Record<string, readonly Constraint[]>;

/** Operand equivalence classes include omitted, empty strings, empty lists, and multiple operands. */
export const INPUT_DOMAINS = {
  lfsCheckout: {
    to: [undefined, '', 'output'],
    patterns: [undefined, '', 'file', [], ['file'], ['a', 'b']],
  },
  pathspec: {
    pathspecFromFile: [undefined, '', 'paths'],
    paths: [[], [''], ['file'], ['file', ''], ['a', 'b']],
    emptyPathspec: [''],
  },
} as const;
