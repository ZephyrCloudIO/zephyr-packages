import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { read_package_json } from './read_package_json';

// Mock Node.js fs and path modules
jest.mock('node:fs');
jest.mock('node:path');

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockJoin = join as jest.MockedFunction<typeof join>;

describe('read_package_json', () => {
  const mockRoot = '/test/root';
  const mockPackageJsonPath = '/test/root/package.json';

  beforeEach(() => {
    jest.clearAllMocks();
    mockJoin.mockReturnValue(mockPackageJsonPath);
  });

  it('should read and parse existing package.json file', () => {
    const mockPackageContent = JSON.stringify({
      name: 'test-app',
      zephyrDependencies: {
        '@org/app': '1.0.0',
      },
    });

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(mockPackageContent);

    const result = read_package_json(mockRoot);

    expect(mockJoin).toHaveBeenCalledWith(mockRoot, 'package.json');
    expect(mockExistsSync).toHaveBeenCalledWith(mockPackageJsonPath);
    expect(mockReadFileSync).toHaveBeenCalledWith(mockPackageJsonPath, 'utf-8');
    expect(result).toEqual({
      name: 'test-app',
      zephyrDependencies: {
        '@org/app': '1.0.0',
      },
    });
  });

  it('should return object with empty zephyrDependencies when package.json does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = read_package_json(mockRoot);

    expect(mockJoin).toHaveBeenCalledWith(mockRoot, 'package.json');
    expect(mockExistsSync).toHaveBeenCalledWith(mockPackageJsonPath);
    expect(mockReadFileSync).not.toHaveBeenCalled();
    expect(result).toEqual({ zephyrDependencies: {} });
  });

  it('should handle package.json with empty zephyrDependencies', () => {
    const mockPackageContent = JSON.stringify({
      name: 'test-app',
      zephyrDependencies: {},
    });

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(mockPackageContent);

    const result = read_package_json(mockRoot);

    expect(result).toEqual({
      name: 'test-app',
      zephyrDependencies: {},
    });
  });

  it('should handle package.json without zephyrDependencies field', () => {
    const mockPackageContent = JSON.stringify({
      name: 'test-app',
      version: '1.0.0',
    });

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(mockPackageContent);

    const result = read_package_json(mockRoot);

    expect(result).toEqual({
      name: 'test-app',
      version: '1.0.0',
      zephyrDependencies: {},
    });
  });
});
