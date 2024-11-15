import { PromiseWithResolvers } from '../index';

describe('PromiseWithResolvers', () => {
  test('should resolve successfully', async () => {
    const { promise, resolve } = PromiseWithResolvers();
    const expectedValue = 'resolved value';

    // Trigger the resolve function
    resolve(expectedValue);

    // Wait for the promise to resolve and verify the result
    await expect(promise).resolves.toBe(expectedValue);
  });

  test('should reject with an error', async () => {
    const { promise, reject } = PromiseWithResolvers();
    const expectedError = new Error('rejected value');

    // Trigger the reject function
    reject(expectedError);

    // Wait for the promise to reject and verify the error
    await expect(promise).rejects.toBe(expectedError);
  });
});
