/**
 * Limits the concurrency of running a list of promise-returning functions.
 *
 * @param tasks An array of functions, each returning a Promise
 * @param batchSize Maximum number of Promises allowed to run concurrently
 * @returns A Promise that resolves to an array of the results
 */
export declare function forEachLimit<T>(
  tasks: Array<() => Promise<T>>,
  batchSize: number
): Promise<T[]>;
