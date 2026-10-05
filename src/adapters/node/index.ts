import type { RuntimeAdapters } from '../../core/adapters.js';
import type { Git } from '../../core/git.js';
import { type CreateGitOptions, createGit, createGitSync } from '../../impl/git-impl.js';
import { GitClient } from '../../internal/client.js';
import { NodeExecAdapter } from './exec.js';
import { NodeFsAdapter } from './fs.js';

export { NodeExecAdapter } from './exec.js';
export { NodeFsAdapter } from './fs.js';

/**
 * Create Node.js runtime adapters
 */
export function createNodeAdapters(): RuntimeAdapters {
  return {
    exec: new NodeExecAdapter(),
    fs: new NodeFsAdapter(),
  };
}

export type TypeGitOptions = Omit<CreateGitOptions, 'adapters'>;

/** Git client preconfigured for Node. */
export class TypeGit extends GitClient {
  public static async create(options?: TypeGitOptions): Promise<TypeGit> {
    return new TypeGit(await createGit({ ...options, adapters: createNodeAdapters() }));
  }

  /** @deprecated Use TypeGit.create() to check Git compatibility. */
  public constructor(constructorOptions?: TypeGitOptions);
  /** @internal */
  public constructor(git: Git);
  public constructor(optionsOrGit?: TypeGitOptions | Git) {
    super(
      optionsOrGit && 'open' in optionsOrGit
        ? optionsOrGit
        : createGitSync({ ...optionsOrGit, adapters: createNodeAdapters() }),
    );
  }
}
