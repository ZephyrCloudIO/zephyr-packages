import fs from 'node:fs';
import path from 'node:path';
import { ZephyrError } from '../../errors';
import { find_nearest_package_json } from '../find-nearest-package-json';
import type { ZeDependency } from '../ze-package-json.type';
import { parseZeDependencies } from '../ze-util-parse-ze-dependencies';
import { getPackageJson } from '../ze-util-read-package-json';

// Mock dependencies
jest.mock('node:fs');
jest.mock('node:fs/promises');
jest.mock('../find-nearest-package-json');
jest.mock('../ze-util-parse-ze-dependencies');
jest.mock('../../logging', () => ({ ze_log: { package: jest.fn() } }));

describe('getPackageJson', () => {
  // Common mock values
  const mockStartPath = '/path/to/project';
  const mockPackageJsonInputObj = {
    name: 'test-package',
    version: '1.0.0',
    dependencies: { 'dep-a': '^1.0.0' },
    'zephyr:dependencies': { 'ze-dep': '^2.0.0' },
  };

  // Mock parsed zephyr dependencies
  const mockParsedZeDeps: Record<string, ZeDependency> = {
    'ze-dep': {
      version: '^2.0.0',
      registry: 'zephyr',
      app_uid: 'ze-dep',
    },
  };

  // Expected result after parsing
  const mockExpectedResultObj = {
    ...mockPackageJsonInputObj,
    zephyrDependencies: mockParsedZeDeps,
  };

  const mockPackageJsonStr = JSON.stringify(mockPackageJsonInputObj);

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();

    // Setup default mocks
    (fs.statSync as jest.Mock).mockReturnValue({ isFile: () => false });
    (find_nearest_package_json as jest.Mock).mockResolvedValue({
      path: path.join(mockStartPath, 'package.json'),
      json: mockPackageJsonStr,
    });
    (parseZeDependencies as jest.Mock).mockReturnValue(mockParsedZeDeps);
  });

  it('should find and parse package.json successfully', async () => {
    // Act
    const result = await getPackageJson(mockStartPath);

    // Assert
    expect(result).toEqual(mockExpectedResultObj);
    expect(find_nearest_package_json).toHaveBeenCalledWith(mockStartPath);
    expect(parseZeDependencies).toHaveBeenCalledWith(
      mockPackageJsonInputObj['zephyr:dependencies']
    );
  });

  it('should handle file paths by moving up one directory', async () => {
    // Arrange
    (fs.statSync as jest.Mock).mockReturnValue({ isFile: () => true });
    const expectedPath = path.resolve(mockStartPath, '..');

    // Act
    await getPackageJson(mockStartPath);

    // Assert
    expect(find_nearest_package_json).toHaveBeenCalledWith(expectedPath);
  });

  it('should use cwd if no path is provided', async () => {
    // Arrange
    const cwd = '/current/working/dir';
    jest.spyOn(process, 'cwd').mockReturnValue(cwd);

    // Act
    await getPackageJson(undefined);

    // Assert
    expect(find_nearest_package_json).toHaveBeenCalledWith(cwd);
  });

  it('should throw if package.json is not found', async () => {
    // Arrange
    (find_nearest_package_json as jest.Mock).mockResolvedValue(null);

    // Act & Assert
    await expect(getPackageJson(mockStartPath)).rejects.toThrow(ZephyrError);
  });

  it('should throw if package.json cannot be parsed', async () => {
    // Arrange
    (find_nearest_package_json as jest.Mock).mockResolvedValue({
      path: path.join(mockStartPath, 'package.json'),
      json: '{ invalid json }',
    });

    // Act & Assert
    await expect(getPackageJson(mockStartPath)).rejects.toThrow(ZephyrError);
  });

  it('should throw if name is missing', async () => {
    // Arrange
    const invalidPackageJson = JSON.stringify({
      version: '1.0.0',
    });

    (find_nearest_package_json as jest.Mock).mockResolvedValue({
      path: path.join(mockStartPath, 'package.json'),
      json: invalidPackageJson,
    });

    // Act & Assert
    await expect(getPackageJson(mockStartPath)).rejects.toThrow(ZephyrError);
  });

  it('should throw if version is missing', async () => {
    // Arrange
    const invalidPackageJson = JSON.stringify({
      name: 'test-package',
    });

    (find_nearest_package_json as jest.Mock).mockResolvedValue({
      path: path.join(mockStartPath, 'package.json'),
      json: invalidPackageJson,
    });

    // Act & Assert
    await expect(getPackageJson(mockStartPath)).rejects.toThrow(ZephyrError);
  });

  it('should not call parseZeDependencies if zephyr:dependencies is undefined', async () => {
    // Arrange
    const packageJsonWithoutZeDeps = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: { 'dep-a': '^1.0.0' },
    };

    (find_nearest_package_json as jest.Mock).mockResolvedValue({
      path: path.join(mockStartPath, 'package.json'),
      json: JSON.stringify(packageJsonWithoutZeDeps),
    });

    // Act
    const result = await getPackageJson(mockStartPath);

    // Assert
    expect(parseZeDependencies).not.toHaveBeenCalled();
    expect(result).toEqual(packageJsonWithoutZeDeps);
  });
});
