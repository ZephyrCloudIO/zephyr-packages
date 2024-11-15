import { deferred } from '../index';

describe('deferred', () => {
  test('should resolve with the expected value', async () => {
    const [promise, resolve] = deferred<string>();
    const expectedValue = 'resolved value';

    // Trigger the resolve function
    resolve(expectedValue);

    // Wait for the promise to resolve and verify the result
    await expect(promise).resolves.toBe(expectedValue);
  });

  test('should reject with the expected reason', async () => {
    const [promise, , reject] = deferred<string>();
    const expectedReason = new Error('rejected reason');

    // Trigger the reject function
    reject(expectedReason);

    // Wait for the promise to reject and verify the reason
    await expect(promise).rejects.toBe(expectedReason);
  });
});
