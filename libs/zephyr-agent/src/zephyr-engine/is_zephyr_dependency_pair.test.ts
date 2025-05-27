import {
  is_zephyr_dependency_pair,
  type ZeDependencyPair,
} from './is_zephyr_dependency_pair';

describe('is_zephyr_dependency_pair', () => {
  it('should return true for valid ZeDependencyPair', () => {
    const validDep: ZeDependencyPair = {
      name: '@my-org/my-app',
      version: '1.0.0',
    };

    expect(is_zephyr_dependency_pair(validDep)).toBe(true);
  });

  it('should return false for undefined', () => {
    expect(is_zephyr_dependency_pair(undefined)).toBe(false);
  });

  it('should return false for null', () => {
    expect(is_zephyr_dependency_pair(null)).toBe(false);
  });

  it('should return true for empty object (truthy)', () => {
    const emptyObj = {} as ZeDependencyPair;
    expect(is_zephyr_dependency_pair(emptyObj)).toBe(true);
  });

  it('should return true for object with partial properties (truthy)', () => {
    const partialObj = { name: 'test' } as ZeDependencyPair;
    expect(is_zephyr_dependency_pair(partialObj)).toBe(true);
  });
});
