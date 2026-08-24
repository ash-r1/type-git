/**
 * Tests for runWithConcurrency
 *
 * All timing is controlled with manually resolved promises - no timers.
 */

import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from './concurrency.js';

interface Deferred {
  promise: Promise<string>;
  resolve: (value: string) => void;
  reject: (error: unknown) => void;
}

function createDeferred(): Deferred {
  let resolve!: (value: string) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let queued microtasks settle so started executions are observable */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

/**
 * Test harness: each item gets a deferred; `started` records launch order.
 */
function createHarness(count: number) {
  const deferreds = Array.from({ length: count }, () => createDeferred());
  const started: number[] = [];
  const run = (_item: number, index: number): Promise<string> => {
    started.push(index);
    const deferred = deferreds[index];
    if (!deferred) {
      throw new Error(`no deferred for index ${index}`);
    }
    return deferred.promise;
  };
  const items = Array.from({ length: count }, (_, i) => i);
  return { deferreds, started, run, items };
}

describe('runWithConcurrency', () => {
  it('does not start more items than the concurrency limit', async () => {
    const { deferreds, started, run, items } = createHarness(6);

    const resultPromise = runWithConcurrency(items, run, { concurrency: 2 });
    await settle();
    expect(started).toEqual([0, 1]);

    deferreds[0]?.resolve('a');
    await settle();
    expect(started).toEqual([0, 1, 2]);

    for (const deferred of deferreds) {
      deferred.resolve('x');
    }
    await resultPromise;
    expect(started).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('processes all items and returns results in input order', async () => {
    const { deferreds, run, items } = createHarness(4);

    const resultPromise = runWithConcurrency(items, run, { concurrency: 3 });
    await settle();
    // Resolve out of order
    deferreds[2]?.resolve('c');
    deferreds[0]?.resolve('a');
    deferreds[1]?.resolve('b');
    await settle();
    deferreds[3]?.resolve('d');

    await expect(resultPromise).resolves.toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not start new items after a failure', async () => {
    const { deferreds, started, run, items } = createHarness(6);

    const resultPromise = runWithConcurrency(items, run, { concurrency: 2 });
    await settle();
    expect(started).toEqual([0, 1]);

    deferreds[0]?.reject(new Error('boom'));
    await settle();
    deferreds[1]?.resolve('b');

    await expect(resultPromise).rejects.toThrow('boom');
    expect(started).toEqual([0, 1]);
  });

  it('waits for in-flight items before rejecting', async () => {
    const { deferreds, run, items } = createHarness(3);

    const resultPromise = runWithConcurrency(items, run, { concurrency: 2 });
    await settle();

    deferreds[0]?.reject(new Error('boom'));
    await settle();

    // Item 1 is still in flight; the call must not settle yet.
    let settled = false;
    void resultPromise.catch(() => {
      settled = true;
    });
    await settle();
    expect(settled).toBe(false);

    deferreds[1]?.resolve('b');
    await expect(resultPromise).rejects.toThrow('boom');
    expect(settled).toBe(true);
  });

  it('rethrows the first error when multiple items fail', async () => {
    const { deferreds, run, items } = createHarness(2);

    const resultPromise = runWithConcurrency(items, run, { concurrency: 2 });
    await settle();

    deferreds[1]?.reject(new Error('second failure first'));
    await settle();
    deferreds[0]?.reject(new Error('first failure later'));

    await expect(resultPromise).rejects.toThrow('second failure first');
  });

  it('returns an empty array for empty input', async () => {
    await expect(
      runWithConcurrency([], () => Promise.resolve('x'), { concurrency: 4 }),
    ).resolves.toEqual([]);
  });

  it('handles concurrency larger than the item count', async () => {
    const { deferreds, started, run, items } = createHarness(2);

    const resultPromise = runWithConcurrency(items, run, { concurrency: 8 });
    await settle();
    expect(started).toEqual([0, 1]);

    deferreds[0]?.resolve('a');
    deferreds[1]?.resolve('b');
    await expect(resultPromise).resolves.toEqual(['a', 'b']);
  });

  it('rejects invalid concurrency and warmupCount', async () => {
    await expect(
      runWithConcurrency([1], () => Promise.resolve('x'), { concurrency: 0 }),
    ).rejects.toThrow(RangeError);
    await expect(
      runWithConcurrency([1], () => Promise.resolve('x'), { concurrency: 1.5 }),
    ).rejects.toThrow(RangeError);
    await expect(
      runWithConcurrency([1], () => Promise.resolve('x'), { concurrency: 1, warmupCount: -1 }),
    ).rejects.toThrow(RangeError);
  });

  it('runs warmup items alone before widening to full concurrency', async () => {
    const { deferreds, started, run, items } = createHarness(6);

    const resultPromise = runWithConcurrency(items, run, {
      concurrency: 4,
      warmupCount: 1,
    });
    await settle();
    // Only the warmup item runs, even though concurrency allows 4.
    expect(started).toEqual([0]);

    deferreds[0]?.resolve('a');
    await settle();
    // After warmup succeeds, the remaining items widen to the limit.
    expect(started).toEqual([0, 1, 2, 3, 4]);

    for (const deferred of deferreds) {
      deferred.resolve('x');
    }
    await resultPromise;
    expect(started).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('starts nothing beyond a failed warmup item', async () => {
    const { deferreds, started, run, items } = createHarness(4);

    const resultPromise = runWithConcurrency(items, run, {
      concurrency: 4,
      warmupCount: 1,
    });
    await settle();
    expect(started).toEqual([0]);

    deferreds[0]?.reject(new Error('warmup failed'));
    await expect(resultPromise).rejects.toThrow('warmup failed');
    expect(started).toEqual([0]);
  });

  it('runs multiple warmup items strictly serially', async () => {
    const { deferreds, started, run, items } = createHarness(4);

    const resultPromise = runWithConcurrency(items, run, {
      concurrency: 4,
      warmupCount: 2,
    });
    await settle();
    expect(started).toEqual([0]);

    deferreds[0]?.resolve('a');
    await settle();
    expect(started).toEqual([0, 1]);

    deferreds[1]?.resolve('b');
    await settle();
    expect(started).toEqual([0, 1, 2, 3]);

    deferreds[2]?.resolve('c');
    deferreds[3]?.resolve('d');
    await expect(resultPromise).resolves.toEqual(['a', 'b', 'c', 'd']);
  });

  it('treats warmupCount larger than the item count as all-serial', async () => {
    const { deferreds, started, run, items } = createHarness(2);

    const resultPromise = runWithConcurrency(items, run, {
      concurrency: 4,
      warmupCount: 10,
    });
    await settle();
    expect(started).toEqual([0]);

    deferreds[0]?.resolve('a');
    await settle();
    expect(started).toEqual([0, 1]);

    deferreds[1]?.resolve('b');
    await expect(resultPromise).resolves.toEqual(['a', 'b']);
  });
});
