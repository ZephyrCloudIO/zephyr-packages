export { forEachLimit } from './forEachLimit';
/**
 * ES 2023 Promise.withResolvers() polyfill
 *
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
 */
export declare function PromiseWithResolvers<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};
/**
 * Creates a deferred promise.
 *
 * @returns A tuple containing the promise, resolve and reject functions in array
 */
export declare function deferred<T>(): [
  Promise<T>,
  (value: T | PromiseLike<T>) => void,
  (reason?: unknown) => void,
];
/**
 * Lazy loads a promise.
 *
 * @link https://github.com/sindresorhus/p-lazy
 */
export declare function PromiseLazyLoad<const T, const P = void>(
  promise: (params: P) => Promise<T>
): (params: P) => Promise<T>;
/** Creates a `[error, value]` tuple value from a promise. */
export declare function PromiseTuple<P>(
  maybePromise: PromiseLike<P> | P
): Promise<[null, P] | [unknown, undefined]>;
export declare function isSuccessTuple<P>(
  tuple: [unknown, P | undefined]
): tuple is [null, P];
