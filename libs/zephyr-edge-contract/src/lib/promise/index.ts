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
 * Creates a deferred promise.
 *
 * @returns A tuple containing the promise, resolve and reject functions in array
 */
export function deferred<T>(): [
  Promise<T>,
  (value: T | PromiseLike<T>) => void,
  (reason?: unknown) => void,
] {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return [promise, resolve, reject];
}

/**
 * Lazy loads a promise.
 *
 * @link https://github.com/sindresorhus/p-lazy
 */
export function PromiseLazyLoad<const T, const P = void>(
  promise: (params: P) => Promise<T>
) {
  let _data: Promise<T> | undefined;

  return (params: P) => {
    if (!_data) {
      _data = promise(params);
    }

    return _data;
  };
}

/** Creates a `[error, value]` tuple value from a promise. */
export async function PromiseTuple<P>(
  maybePromise: PromiseLike<P> | P
): Promise<[null, P] | [unknown, undefined]> {
  try {
    return [null, await maybePromise];
  } catch (err) {
    return [err, undefined];
  }
}

export function isSuccessTuple<P>(tuple: [unknown, P | undefined]): tuple is [null, P] {
  return tuple[0] === null;
}
