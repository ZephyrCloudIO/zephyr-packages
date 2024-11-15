import { isSuccessTuple, PromiseTuple } from '../index';

describe('PromiseTuple', () => {
  test('should resolve with [null, value] for a resolved promise', async () => {
    const value = 'resolved value';
    const tuple = await PromiseTuple(Promise.resolve(value));

    expect(tuple).toEqual([null, value]);
  });

  test('should resolve with [null, value] for a non-promise value', async () => {
    const value = 'non-promise value';
    const tuple = await PromiseTuple(value);

    expect(tuple).toEqual([null, value]);
  });

  test('should resolve with [error, undefined] for a rejected promise', async () => {
    const error = new Error('rejected value');
    const tuple = await PromiseTuple(Promise.reject(error));

    expect(tuple).toEqual([error, undefined]);
  });
});

describe('isSuccessTuple', () => {
  test('should return true for a success tuple', () => {
    const tuple: [null, string] = [null, 'value'];

    expect(isSuccessTuple(tuple)).toBe(true);
  });

  test('should return false for an error tuple', () => {
    const tuple: [Error, undefined] = [new Error('error'), undefined];

    expect(isSuccessTuple(tuple)).toBe(false);
  });
});
