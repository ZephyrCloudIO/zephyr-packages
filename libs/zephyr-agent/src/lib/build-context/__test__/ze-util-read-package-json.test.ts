import fs from 'node:fs';
import path from 'node:path';
import { getPackageJson } from '../ze-util-read-package-json';
import { find_nearest_package_json } from '../find-nearest-package-json';
import { getPackageJsonCache, setPackageJsonCache } from '../fs-cache-for-package-json';
import { ZephyrError } from '../../errors';

// Mock dependencies
jest.mock('node:fs');
jest.mock('node:fs/promises');
jest.mock('../find-nearest-package-json');
jest.mock('../fs-cache-for-package-json');
jest.mock('../../logging', () => ({
  ze_log: jest.fn(),
}));

describe('getPackageJson', () => {
  // Common mock values
  const mockStartPath = '/path/to/project';
  const mockPackageJsonObj = {
    name: 'test-package',
    version: '1.0.0',
    dependencies: { 'dep-a': '^1.0.0' },
    zephyrDependencies: { 'ze-dep': '^2.0.0' },
  };
  const mockPackageJsonStr = JSON.stringify(mockPackageJsonObj);

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();

    // Setup default mocks
    (fs.statSync as jest.Mock).mockReturnValue({ isFile: () => false });
    (find_nearest_package_json as jest.Mock).mockResolvedValue({
      path: path.join(mockStartPath, 'package.json'),
      json: mockPackageJsonStr,
    });
    (getPackageJsonCache as jest.Mock).mockResolvedValue(undefined);
  });

  it('should find and parse package.json successfully', async () => {
    // Act
    const result = await getPackageJson(mockStartPath);

    // Assert
    expect(result).toEqual(mockPackageJsonObj);
    expect(find_nearest_package_json).toHaveBeenCalledWith(mockStartPath);
    expect(setPackageJsonCache).toHaveBeenCalledWith(mockStartPath, mockPackageJsonObj);
  });

  it('should use cache if available', async () => {
    // Arrange
    (getPackageJsonCache as jest.Mock).mockResolvedValue(mockPackageJsonObj);

    // Act
    const result = await getPackageJson(mockStartPath);

    // Assert
    expect(result).toEqual(mockPackageJsonObj);
    expect(find_nearest_package_json).not.toHaveBeenCalled();
    expect(setPackageJsonCache).not.toHaveBeenCalled();
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
});
