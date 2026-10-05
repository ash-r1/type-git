import type { RuntimeAdapters } from '../../core/adapters.js';
import type { Git } from '../../core/git.js';
import { type CreateGitOptions, createGit, createGitSync } from '../../impl/git-impl.js';
import { GitClient } from '../../internal/client.js';
import { DenoExecAdapter } from './exec.js';
import { DenoFsAdapter } from './fs.js';

export { DenoExecAdapter } from './exec.js';
export { DenoFsAdapter } from './fs.js';

/**
 * Create Deno runtime adapters
 */
export function createDenoAdapters(): RuntimeAdapters {
  return {
    exec: new DenoExecAdapter(),
    fs: new DenoFsAdapter(),
  };
}

export type TypeGitOptions = Omit<CreateGitOptions, 'adapters'>;

/** Git client preconfigured for Deno. */
export class TypeGit extends GitClient {
  public static async create(options?: TypeGitOptions): Promise<TypeGit> {
    return new TypeGit(await createGit({ ...options, adapters: createDenoAdapters() }));
  }

  /** @deprecated Use TypeGit.create() to check Git compatibility. */
  public constructor(constructorOptions?: TypeGitOptions);
  /** @internal */
  public constructor(git: Git);
  public constructor(optionsOrGit?: TypeGitOptions | Git) {
    super(
      optionsOrGit && 'open' in optionsOrGit
        ? optionsOrGit
        : createGitSync({ ...optionsOrGit, adapters: createDenoAdapters() }),
    );
  }
}
