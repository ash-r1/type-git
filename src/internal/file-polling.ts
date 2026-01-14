/**
 * Internal module for file polling logic
 *
 * Extracts common polling state machine from runtime-specific adapters.
 * NOT part of public API - internal use only.
 */

/**
 * Runtime-specific file operations
 */
export interface FilePollingAdapter {
  /**
   * Read new chunk from file starting at position
   * @param position - Current byte position in file
   * @returns New data and updated position, or null if file doesn't exist/error
   */
  readChunk(position: number): Promise<{ data: string; newPosition: number } | null>;

  /**
   * Async sleep for polling interval
   * @param ms - Milliseconds to sleep
   */
  sleep(ms: number): Promise<void>;
}

/**
 * Options for file polling
 */
export interface FilePollingOptions {
  /** Runtime-specific adapter */
  adapter: FilePollingAdapter;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Polling interval in milliseconds (default: 100) */
  pollInterval?: number;
}

/**
 * Handle returned by tail streaming
 *
 * Implements AsyncDisposable for use with `await using`.
 */
export interface TailStreamingHandle extends AsyncDisposable {
  /** Async iterable for reading lines */
  lines: AsyncIterable<string>;
  /** Stop polling and close resources */
  stop(): void;
}

/**
 * Options for callback-based tail polling
 */
export interface TailCallbackOptions {
  /** Runtime-specific adapter */
  adapter: FilePollingAdapter;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Polling interval in milliseconds (default: 100) */
  pollInterval?: number;
  /** Callback for each line */
  onLine: (line: string) => void;
}

/**
 * Run tail polling with callback (non-streaming)
 *
 * Used by the callback-based tail() method.
 *
 * @param options - Polling options with callback
 */
export async function runTailPolling(options: TailCallbackOptions): Promise<void> {
  const { adapter, signal, pollInterval = 100, onLine } = options;

  let position = 0;
  let buffer = '';

  while (!signal?.aborted) {
    const result = await adapter.readChunk(position);

    if (result !== null && result.data.length > 0) {
      position = result.newPosition;
      buffer += result.data;

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line) {
          onLine(line);
        }
      }
    }

    if (!signal?.aborted) {
      await adapter.sleep(pollInterval);
    }
  }
}

/**
 * Internal polling state
 */
interface PollingState {
  stopped: boolean;
  resolveNext: ((value: IteratorResult<string, undefined>) => void) | null;
  lineQueue: string[];
}

/**
 * Create tail polling with async iteration support
 *
 * This is the main entry point used by runtime adapters.
 *
 * @param options - Polling options
 * @returns Handle with lines iterator and stop function
 */
export function createTailPolling(options: FilePollingOptions): TailStreamingHandle {
  const { adapter, signal, pollInterval = 100 } = options;

  const state: PollingState = {
    stopped: false,
    resolveNext: null,
    lineQueue: [],
  };

  const stop = (): void => {
    state.stopped = true;
    if (state.resolveNext) {
      state.resolveNext({ done: true, value: undefined });
      state.resolveNext = null;
    }
  };

  // Start polling in background
  startPollingLoop(adapter, state, signal, pollInterval, stop).catch(() => {
    // Intentionally ignored - startPollingLoop handles its own cleanup
  });

  const lines: AsyncIterable<string> = {
    [Symbol.asyncIterator](): AsyncIterator<string> {
      return {
        next(): Promise<IteratorResult<string>> {
          if (state.stopped) {
            return Promise.resolve({ done: true, value: undefined });
          }

          if (state.lineQueue.length > 0) {
            const value = state.lineQueue.shift();
            if (value !== undefined) {
              return Promise.resolve({ done: false, value });
            }
          }

          return new Promise((resolve) => {
            state.resolveNext = resolve;
          });
        },
      };
    },
  };

  return {
    lines,
    stop,
    [Symbol.asyncDispose]: (): Promise<void> => {
      stop();
      return Promise.resolve();
    },
  };
}

/**
 * Main polling loop - extracted from runtime adapters
 */
async function startPollingLoop(
  adapter: FilePollingAdapter,
  state: PollingState,
  signal: AbortSignal | undefined,
  pollInterval: number,
  stop: () => void,
): Promise<void> {
  let position = 0;
  let buffer = '';

  while (!(state.stopped || signal?.aborted)) {
    const result = await adapter.readChunk(position);

    if (result !== null && result.data.length > 0) {
      position = result.newPosition;
      buffer += result.data;

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line) {
          if (state.resolveNext) {
            const resolver = state.resolveNext;
            state.resolveNext = null;
            resolver({ done: false, value: line });
          } else {
            state.lineQueue.push(line);
          }
        }
      }
    }

    await adapter.sleep(pollInterval);
  }

  // Final cleanup
  stop();
}
