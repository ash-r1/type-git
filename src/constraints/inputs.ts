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
  // repo.commit emits no paths, and its fixup is a free string. These stay runtime checks:
  // modeling them in CommitOpts multiplies the compiler's work on every caller of the type.
  commitPaths: [
    {
      id: 'commit.only-paths',
      kind: 'requiresAny',
      when: { key: 'only', test: 'active' },
      choices: [
        { key: 'pathspecFromFile', test: 'nonempty' },
        { key: 'allowEmpty', test: 'active' },
        { key: 'amend', test: 'active' },
        { key: 'fixup', test: 'startsWith', value: 'amend:' },
      ],
      origin: 'git',
      reason: 'Only mode without paths requires allowEmpty, amend or an amend: fixup.',
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/commit.c',
    },
    {
      id: 'commit.reword-content',
      kind: 'conflicts',
      when: { key: 'fixup', test: 'startsWith', value: 'reword:' },
      others: [
        { key: 'include', test: 'active' },
        { key: 'only', test: 'active' },
        { key: 'all', test: 'active' },
      ],
      origin: 'git',
      reason: 'A reword: fixup cannot include changed files.',
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/commit.c',
    },
    // Runtime checks: in CommitOpts these exceed the compiler's union budget.
    {
      id: 'commit.fixup-suboption',
      kind: 'scalar',
      key: 'fixup',
      parser: 'commit-fixup',
      origin: 'git',
      reason: 'A fixup suboption (letters before a colon) must be amend or reword.',
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/commit.c',
    },
    {
      id: 'commit.reset-author-amend-fixup',
      kind: 'forbid',
      when: [
        { key: 'resetAuthor', test: 'active' },
        { key: 'amend', test: 'active' },
        { key: 'fixup', test: 'nonempty' },
      ],
      origin: 'git',
      reason: 'With a fixup, amend reuses no message, so resetAuthor has nothing to reset.',
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/commit.c',
    },
    {
      id: 'commit.fixup-amend-message',
      kind: 'forbid',
      when: [
        { key: 'fixup', test: 'startsWith', value: 'amend:' },
        { key: 'message', test: 'nonempty' },
      ],
      origin: 'git',
      reason: 'An amend: fixup takes its message from the amended commit, not from a message.',
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/commit.c',
    },
    {
      id: 'commit.fixup-reword-message',
      kind: 'forbid',
      when: [
        { key: 'fixup', test: 'startsWith', value: 'reword:' },
        { key: 'message', test: 'nonempty' },
      ],
      origin: 'git',
      reason: 'A reword: fixup takes its message from the amended commit, not from a message.',
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/commit.c',
    },
    {
      id: 'commit.author-ident',
      kind: 'scalar',
      key: 'author',
      parser: 'commit-author',
      // repo.commit skips an empty author; dry runs return before determine_author_info.
      guard: [
        { key: 'author', test: 'nonempty' },
        { key: 'dryRun', test: 'inactive' },
      ],
      origin: 'git',
      reason: "An author containing '>' must be 'Name <email>' with a nonempty name.",
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/commit.c',
    },
    {
      id: 'commit.date',
      kind: 'scalar',
      key: 'date',
      parser: 'commit-date',
      // repo.commit skips an empty date and converts a Date, which still needs a valid time.
      guard: [
        { key: 'date', test: 'present' },
        { key: 'date', test: 'notEquals', value: '' },
        { key: 'dryRun', test: 'inactive' },
      ],
      origin: 'git',
      reason: 'The date must be a Git date (parse_date or approxidate).',
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/commit.c',
    },
  ],
  restorePaths: [
    {
      id: 'restore.paths',
      kind: 'requiresAny',
      when: { key: 'paths', test: 'lengthEquals', value: 0 },
      // An empty pathspecFromFile is not emitted, so it does not count.
      choices: [{ key: 'pathspecFromFile', test: 'nonempty' }],
      origin: 'git',
      reason: 'Restore without patch mode needs paths or a pathspec file.',
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/checkout.c',
    },
    {
      id: 'restore.source-empty',
      kind: 'forbid',
      when: [{ key: 'source', test: 'equals', value: '' }],
      origin: 'git',
      reason:
        'Git cannot resolve an empty --source tree-ish; omit source to restore from the index instead.',
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/checkout.c',
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
  switchTarget: [
    {
      id: 'switch.empty-branch',
      kind: 'forbid',
      when: [{ key: 'branch', test: 'equals', value: '' }],
      origin: 'git',
      reason:
        'An empty switch target is never a valid reference or branch name, with or without create, force-create or orphan.',
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/checkout.c',
    },
    {
      id: 'switch.track-start-point',
      kind: 'scalar',
      key: 'branch',
      parser: 'track-start-point',
      guard: [
        { key: 'track', test: 'active' },
        { key: 'create', test: 'inactive' },
        { key: 'forceCreate', test: 'inactive' },
        { key: 'orphan', test: 'inactive' },
      ],
      origin: 'git',
      reason:
        "--track without create, forceCreate or orphan names the new branch after the first '/' of the target (after refs/ and remotes/), which must leave a nonempty name.",
      source: 'https://github.com/git/git/blob/v2.55.0/builtin/checkout.c',
    },
  ],
} as const satisfies Record<string, readonly Constraint[]>;

/** Operand equivalence classes include omitted, empty strings, empty lists, and multiple operands. */
export const INPUT_DOMAINS = {
  lfsCheckout: {
    to: [undefined, '', 'output'],
    patterns: [undefined, '', 'file', [], ['file'], ['a', 'b']],
  },
  commitPaths: {
    only: [undefined, false, true],
    include: [undefined, false, true],
    all: [undefined, false, true],
    allowEmpty: [undefined, false, true],
    amend: [undefined, false, true],
    pathspecFromFile: [undefined, '', 'paths'],
    fixup: [undefined, '', 'HEAD', 'amend:HEAD', 'reword:HEAD', 'Amend:HEAD', 'x:HEAD'],
    message: [undefined, '', 'm'],
    resetAuthor: [undefined, false, true],
    author: [undefined, '', 'A <a@example.test>', 'nickname', 'x>'],
    date: [undefined, 'now', 'friday'],
    dryRun: [undefined, false, true],
  },
  pathspec: {
    pathspecFromFile: [undefined, '', 'paths'],
    paths: [[], [''], ['file'], ['file', ''], ['a', 'b']],
    emptyPathspec: [''],
  },
  restorePaths: {
    paths: [[], ['file']],
    pathspecFromFile: [undefined, '', 'paths'],
    source: [undefined, '', 'HEAD'],
  },
  switchTarget: {
    branch: ['', 'main', 'origin/main', 'origin/', 'refs/remotes/main'],
    track: [undefined, true],
    create: [undefined, true],
    forceCreate: [undefined, true],
    orphan: [undefined, true],
  },
} as const;
