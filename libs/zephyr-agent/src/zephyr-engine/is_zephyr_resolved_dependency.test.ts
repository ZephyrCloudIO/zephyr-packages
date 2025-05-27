import { is_zephyr_resolved_dependency } from './is_zephyr_resolved_dependency';
import type { ZeResolvedDependency } from './resolve_remote_dependency';

describe('is_zephyr_resolved_dependency', () => {
  it('should return true for valid ZeResolvedDependency', () => {
    const validDep: ZeResolvedDependency = {
      name: '@my-org/my-app',
      version: '1.0.0',
      default_url: 'https://example.com/remoteEntry.js',
    };

    expect(is_zephyr_resolved_dependency(validDep)).toBe(true);
  });

  it('should return false for null', () => {
    expect(is_zephyr_resolved_dependency(null)).toBe(false);
  });

  it('should return true for empty object (not null)', () => {
    const emptyObj = {} as ZeResolvedDependency;
    expect(is_zephyr_resolved_dependency(emptyObj)).toBe(true);
  });

  it('should return true for object with partial properties (not null)', () => {
    const partialObj = { name: 'test' } as ZeResolvedDependency;
    expect(is_zephyr_resolved_dependency(partialObj)).toBe(true);
  });
});
