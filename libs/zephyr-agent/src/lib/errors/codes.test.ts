import { describe, expect, it } from '@rstest/core';
import { ZeErrors } from './codes';
import { ZephyrError } from './zephyr-error';

describe('ZeErrors', () => {
  it('gives every error a unique id within its category', () => {
    const namesByCode = new Map<string, string[]>();
    for (const [name, error] of Object.entries(ZeErrors)) {
      const code = ZephyrError.toZeCode(error);
      namesByCode.set(code, [...(namesByCode.get(code) ?? []), name]);
    }

    const duplicates = [...namesByCode].filter(([, names]) => names.length > 1);

    expect(duplicates).toEqual([]);
  });
});
