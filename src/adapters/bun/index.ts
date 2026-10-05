import type { RuntimeAdapters } from '../../core/adapters.js';
import type { Git } from '../../core/git.js';
import { type CreateGitOptions, createGit, createGitSync } from '../../impl/git-impl.js';
import { GitClient } from '../../internal/client.js';
import { BunExecAdapter } from './exec.js';
import { BunFsAdapter } from './fs.js';

export { BunExecAdapter } from './exec.js';
export { BunFsAdapter } from './fs.js';

/**
 * Create Bun runtime adapters
 */
export function createBunAdapters(): RuntimeAdapters {
  return {
    exec: new BunExecAdapter(),
    fs: new BunFsAdapter(),
  };
}

export type TypeGitOptions = Omit<CreateGitOptions, 'adapters'>;

/** Git client preconfigured for Bun. */
export class TypeGit extends GitClient {
  public static async create(options?: TypeGitOptions): Promise<TypeGit> {
    return new TypeGit(await createGit({ ...options, adapters: createBunAdapters() }));
  }

  /** @deprecated Use TypeGit.create() to check Git compatibility. */
  public constructor(constructorOptions?: TypeGitOptions);
  /** @internal */
  public constructor(git: Git);
  public constructor(optionsOrGit?: TypeGitOptions | Git) {
    super(
      optionsOrGit && 'open' in optionsOrGit
        ? optionsOrGit
        : createGitSync({ ...optionsOrGit, adapters: createBunAdapters() }),
    );
  }
}
