/* eslint-disable @typescript-eslint/no-explicit-any */
import { objHasKeys } from './object-has-keys';

describe('objHasKeys', () => {
  it('should return true if the object has all the specified keys', () => {
    const obj = {
      foo: {
        bar: {
          baz: 'value',
        },
      },
    };
    const pathArr = ['foo', 'bar', 'baz'];
    const result = objHasKeys(obj, pathArr);
    expect(result).toBe(true);
  });

  it('should return false if the object does not have all the specified keys', () => {
    const obj = {
      foo: {
        bar: {
          baz: 'value',
        },
      },
    };
    const pathArr = ['foo', 'bar', 'qux'];
    const result = objHasKeys(obj, pathArr);
    expect(result).toBe(false);
  });

  it('should return false if any intermediate key is missing', () => {
    const obj = {
      foo: {
        bar: {
          baz: 'value',
        },
      },
    };
    const pathArr = ['foo', 'qux', 'baz'];
    const result = objHasKeys(obj, pathArr);
    expect(result).toBe(false);
  });

  it('should return false if the object is null', () => {
    const obj = null;
    const pathArr = ['foo', 'bar', 'baz'];
    const result = objHasKeys(obj as any, pathArr);
    expect(result).toBe(false);
  });

  it('should return false if the object is undefined', () => {
    const obj = undefined;
    const pathArr = ['foo', 'bar', 'baz'];
    const result = objHasKeys(obj as any, pathArr);
    expect(result).toBe(false);
  });

  it('should return false if the object is empty', () => {
    const obj = {};
    const pathArr = ['foo', 'bar', 'baz'];
    const result = objHasKeys(obj, pathArr);
    expect(result).toBe(false);
  });
});
