/**
 * ES 2023 Promise.withResolvers() polyfill
 *
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
 */
export function PromiseWithResolvers<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/** Creates a `[boolean, error, value]` tuple value from a promise. */
export async function PromiseTuple<P>(maybePromise: PromiseLike<P> | P): Promise<[false, unknown] | [true, null, P]> {
  try {
    return [true, null, await maybePromise];
  } catch (err) {
    return [false, err];
  }
}
