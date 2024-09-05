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

/**
 * Creates a `[error, value]` tuple from a promise.
 *
 * @link https://www.npmjs.com/package/tuple-it
 */
export async function PromiseTuple<P>(maybePromise: PromiseLike<P> | P): Promise<[Error] | [null, P]> {
  try {
    // await because then is not present on non-Promise objects
    return [null, await maybePromise];
  } catch (err) {
    // Wrapping into Error avoids the need to check
    // `if (error !== undefined)` in favor of a simpler `if (error)`
    if (err instanceof Error) {
      return [err];
    }

    const error: any = new Error('Promise rejected without an error');
    error.data = err;
    return [error];
  }
}

/**
 * Lazy loads a promise.
 *
 * @link https://github.com/sindresorhus/p-lazy
 */
export function PromiseLazyLoad<const T, const P = void>(promise: (params: P) => Promise<T>) {
  let _data: Promise<T> | undefined;

  return (params: P) => {
    if (!_data) {
      _data = promise(params);
    }

    return _data;
  };
}
