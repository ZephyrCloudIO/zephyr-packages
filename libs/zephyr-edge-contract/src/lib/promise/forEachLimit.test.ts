import { forEachLimit } from './forEachLimit';

describe('forEachLimit', () => {
  // Helper to create a delayed promise
  const createDelayedPromise = (value: number, delay: number) => {
    return () =>
      new Promise<number>((resolve) => {
        setTimeout(() => resolve(value), delay);
      });
  };

  it('should process all tasks and return results in correct order', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.resolve(2),
      () => Promise.resolve(3),
    ];

    const results = await forEachLimit(tasks, 2);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should handle empty task array', async () => {
    const tasks: Array<() => Promise<number>> = [];
    const results = await forEachLimit(tasks, 2);
    expect(results).toEqual([]);
  });

  it('should respect concurrency limit', async () => {
    const executionOrder: number[] = [];
    const tasks = [
      // Task 1: completes after 100ms
      () =>
        new Promise<number>((resolve) => {
          setTimeout(() => {
            executionOrder.push(1);
            resolve(1);
          }, 100);
        }),
      // Task 2: completes after 50ms
      () =>
        new Promise<number>((resolve) => {
          setTimeout(() => {
            executionOrder.push(2);
            resolve(2);
          }, 50);
        }),
      // Task 3: completes immediately
      () =>
        new Promise<number>((resolve) => {
          executionOrder.push(3);
          resolve(3);
        }),
    ];

    const results = await forEachLimit(tasks, 2);

    // With batchSize of 2, task 3 should wait for either task 1 or 2 to complete
    // Task 2 completes first, then task 3, and finally task 1
    expect(executionOrder).toEqual([2, 3, 1]);
    // Results should still be in original order
    expect(results).toEqual([1, 2, 3]);
  });

  it('should handle rejected promises', async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error('Task failed')),
      () => Promise.resolve(3),
    ];

    await expect(forEachLimit(tasks, 2)).rejects.toThrow('Task failed');
  });

  it('should handle large number of tasks efficiently', async () => {
    const taskCount = 100;
    const tasks = Array.from({ length: taskCount }, (_, i) =>
      createDelayedPromise(i, Math.random() * 10)
    );

    const results = await forEachLimit(tasks, 5);
    expect(results).toHaveLength(taskCount);
    expect(results[0]).toBe(0);
    expect(results[taskCount - 1]).toBe(taskCount - 1);
  });
});
