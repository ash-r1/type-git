import type { RuntimeAdapters } from '../../core/adapters.js';
import type { Git } from '../../core/git.js';
import { type CreateGitOptions, createGit, createGitSync } from '../../impl/git-impl.js';
import { GitClient } from '../../internal/client.js';
import { NodeExecAdapter, type NodeExecAdapterOptions } from './exec.js';
import { NodeFsAdapter } from './fs.js';

export { NodeExecAdapter, type NodeExecAdapterOptions } from './exec.js';
export { NodeFsAdapter } from './fs.js';

/** Options for {@link createNodeAdapters}. */
export type NodeAdaptersOptions = NodeExecAdapterOptions;

/**
 * Create Node.js runtime adapters
 */
export function createNodeAdapters(options?: NodeAdaptersOptions): RuntimeAdapters {
  return {
    exec: new NodeExecAdapter(options),
    fs: new NodeFsAdapter(),
  };
}

export type TypeGitOptions = Omit<CreateGitOptions, 'adapters'> & NodeAdaptersOptions;

/**
 * Separate Node adapter options from `createGit` options so `windowsHide` reaches the
 * execution adapter and is not forwarded to `createGit`.
 */
function splitOptions(options: TypeGitOptions | undefined): CreateGitOptions {
  const { windowsHide, ...gitOptions } = options ?? {};
  return {
    ...gitOptions,
    adapters: createNodeAdapters(windowsHide === undefined ? undefined : { windowsHide }),
  };
}

/** Git client preconfigured for Node. */
export class TypeGit extends GitClient {
  public static async create(options?: TypeGitOptions): Promise<TypeGit> {
    return new TypeGit(await createGit(splitOptions(options)));
  }

  /** @deprecated Use TypeGit.create() to check Git compatibility. */
  public constructor(constructorOptions?: TypeGitOptions);
  /** @internal */
  public constructor(git: Git);
  public constructor(optionsOrGit?: TypeGitOptions | Git) {
    super(
      optionsOrGit && 'open' in optionsOrGit
        ? optionsOrGit
        : createGitSync(splitOptions(optionsOrGit)),
    );
  }
}
