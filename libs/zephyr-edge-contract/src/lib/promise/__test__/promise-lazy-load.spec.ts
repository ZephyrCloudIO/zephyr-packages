import { PromiseLazyLoad } from '../index';

describe('PromiseLazyLoad', () => {
  test('should call the promise function only once', async () => {
    const mockPromise = jest.fn(async (params) => {
      return `resolved with ${params}`;
    });

    const lazyLoad = PromiseLazyLoad(mockPromise);
    const params = 'test params';

    // Call the lazy load function twice with the same parameters
    const promise1 = lazyLoad(params);
    const promise2 = lazyLoad(params);

    // Both promises should be the same instance
    expect(promise1).toBe(promise2);

    // Wait for the promise to resolve and verify the result
    await expect(promise1).resolves.toBe(`resolved with ${params}`);

    // Verify the mock function is called only once
    expect(mockPromise).toHaveBeenCalledTimes(1);
    expect(mockPromise).toHaveBeenCalledWith(params);
  });

  test('should return the same promise for subsequent calls', async () => {
    const mockPromise = jest.fn(async (params) => {
      return `resolved with ${params}`;
    });

    const lazyLoad = PromiseLazyLoad(mockPromise);
    const params1 = 'first params';
    const params2 = 'second params';

    // Call the lazy load function with different parameters
    const promise1 = lazyLoad(params1);
    const promise2 = lazyLoad(params2);

    // The promise should be the same instance regardless of the parameters
    expect(promise1).toBe(promise2);

    // Wait for the promise to resolve and verify the result
    await expect(promise1).resolves.toBe(`resolved with ${params1}`);

    // Verify the mock function is called only once
    expect(mockPromise).toHaveBeenCalledTimes(1);
    expect(mockPromise).toHaveBeenCalledWith(params1);
  });
});
