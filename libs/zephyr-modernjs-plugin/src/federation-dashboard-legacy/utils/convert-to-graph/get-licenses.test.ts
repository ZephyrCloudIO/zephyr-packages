/* eslint-disable @typescript-eslint/no-explicit-any */
import { getLicenses } from './get-licenses';

describe('getLicenses', () => {
  it('should return licenses joined by comma if licenses is an array', () => {
    const packageJson = {
      licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }, { type: 'GPL-3.0' }],
    };
    const result = getLicenses(packageJson as any);
    expect(result).toEqual('MIT, Apache-2.0, GPL-3.0');
  });

  it('should return license type if licenses is not an array', () => {
    const packageJson = {
      licenses: { type: 'MIT' },
    };
    const result = getLicenses(packageJson as any);
    expect(result).toEqual('MIT');
  });

  it('should return license type if licenses is not defined', () => {
    const packageJson = {
      license: { type: 'MIT' },
    };
    const result = getLicenses(packageJson as any);
    expect(result).toEqual('MIT');
  });

  it('should return undefined if licenses and license are not defined', () => {
    const packageJson = {};
    const result = getLicenses(packageJson as any);
    expect(result).toBeUndefined();
  });
});
