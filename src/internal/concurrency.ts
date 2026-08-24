/**
 * Internal module for bounded-concurrency execution
 *
 * NOT part of public API - internal use only.
 */

/**
 * Options for {@link runWithConcurrency}
 */
export interface RunWithConcurrencyOptions {
  /** Maximum number of items processed at the same time (positive integer) */
  concurrency: number;
  /**
   * Number of leading items to run one at a time before widening to full
   * concurrency (default: 0).
   *
   * When a failure is likely to affect every item the same way (e.g. an
   * unreachable remote), running the first item alone discovers that failure
   * with a single attempt instead of `concurrency` parallel attempts.
   */
  warmupCount?: number;
}

/**
 * Run `run` over `items` with a bounded number of concurrent executions.
 *
 * Guarantees:
 * - At most `concurrency` executions are in flight at any moment.
 * - The first `warmupCount` items run strictly one at a time; remaining items
 *   start only after the warmup items have all succeeded.
 * - After the first rejection, no new item is started.
 * - In-flight executions are awaited before the returned promise rejects, so
 *   no execution outlives this call.
 * - When multiple executions reject, the first rejection (in completion
 *   order) is rethrown.
 *
 * Unlike a naive `Promise.all(items.map(run))`, this keeps failure cost
 * bounded: a failure stops scheduling instead of letting every remaining
 * item run to completion.
 *
 * @returns Results in input order.
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  run: (item: T, index: number) => Promise<R>,
  options: RunWithConcurrencyOptions,
): Promise<R[]> {
  const { concurrency, warmupCount = 0 } = options;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError(`concurrency must be a positive integer, got: ${concurrency}`);
  }
  if (!Number.isInteger(warmupCount) || warmupCount < 0) {
    throw new RangeError(`warmupCount must be a non-negative integer, got: ${warmupCount}`);
  }

  const results: R[] = new Array<R>(items.length);
  let nextIndex = 0;
  let failed = false;
  let firstError: unknown;

  const runOne = async (index: number): Promise<void> => {
    try {
      const item = items[index] as T;
      results[index] = await run(item, index);
    } catch (error) {
      if (!failed) {
        failed = true;
        firstError = error;
      }
    }
  };

  // Warmup phase: leading items run strictly serially.
  const warmupEnd = Math.min(warmupCount, items.length);
  while (nextIndex < warmupEnd && !failed) {
    await runOne(nextIndex++);
  }

  // Main phase: workers pull the next index until exhausted or failed.
  if (!failed && nextIndex < items.length) {
    const worker = async (): Promise<void> => {
      while (!failed && nextIndex < items.length) {
        await runOne(nextIndex++);
      }
    };
    const workerCount = Math.min(concurrency, items.length - nextIndex);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }

  if (failed) {
    throw firstError;
  }
  return results;
}
