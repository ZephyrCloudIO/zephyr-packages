/**
 * Limits the concurrency of running a list of promise-returning functions.
 *
 * @param tasks An array of functions, each returning a Promise
 * @param batchSize Maximum number of Promises allowed to run concurrently
 * @returns A Promise that resolves to an array of the results
 */
export async function forEachLimit<T>(
  tasks: Array<() => Promise<T>>,
  batchSize: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let currentIndex = 0;

  // Worker function: runs until there are no more tasks left.
  // Each worker picks the next available task and runs it.
  async function worker() {
    while (currentIndex < tasks.length) {
      const taskIndex = currentIndex++;
      const task = tasks[taskIndex];
      // Execute the task and store the result in the correct position
      results[taskIndex] = await task();
    }
  }

  // Create a pool of "batchSize" workers
  const workers = Array.from({ length: batchSize }, () => worker());

  // Wait until all workers finish
  await Promise.all(workers);

  return results;
}
