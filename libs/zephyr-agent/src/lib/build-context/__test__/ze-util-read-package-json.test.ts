import { rs } from '@rstest/core';
import fs from 'node:fs';
import path from 'node:path';
import { ZeErrors, ZephyrError } from '../../errors';
import * as findNearestModule from '../find-nearest-package-json';
import type { ZeDependency } from '../ze-package-json.type';
import * as logEventModule from '../../logging/ze-log-event';
import * as parseDepsModule from '../ze-util-parse-ze-dependencies';
import { getPackageJson } from '../ze-util-read-package-json';

const jest = rs;
const statSyncMock = jest.spyOn(fs, 'statSync');
const findNearestPackageJsonMock = jest.spyOn(findNearestModule, 'find_nearest_package_json');
const parseZeDependenciesMock = jest.spyOn(parseDepsModule, 'parseZeDependencies');
const logFnMock = jest.spyOn(logEventModule, 'logFn');

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
    statSyncMock.mockReturnValue({ isFile: () => false } as fs.Stats);
    findNearestPackageJsonMock.mockResolvedValue({
      path: path.join(mockStartPath, 'package.json'),
      json: mockPackageJsonStr,
    });
    parseZeDependenciesMock.mockReturnValue(mockParsedZeDeps);
    logFnMock.mockImplementation(() => undefined);
  });

  it('should find and parse package.json successfully', async () => {
    // Act
    const result = await getPackageJson(mockStartPath);

    // Assert
    expect(result).toEqual(mockExpectedResultObj);
    expect(findNearestPackageJsonMock).toHaveBeenCalledWith(mockStartPath);
    expect(parseZeDependenciesMock).toHaveBeenCalledWith(
      mockPackageJsonInputObj['zephyr:dependencies']
    );
  });

  it('should handle file paths by moving up one directory', async () => {
    // Arrange
    statSyncMock.mockReturnValue({ isFile: () => true } as fs.Stats);
    const expectedPath = path.resolve(mockStartPath, '..');

    // Act
    await getPackageJson(mockStartPath);

    // Assert
    expect(findNearestPackageJsonMock).toHaveBeenCalledWith(expectedPath);
  });

  it('should use cwd if no path is provided', async () => {
    // Arrange
    const cwd = '/current/working/dir';
    jest.spyOn(process, 'cwd').mockReturnValue(cwd);

    // Act
    await getPackageJson(undefined);

    // Assert
    expect(findNearestPackageJsonMock).toHaveBeenCalledWith(cwd);
  });

  it('should throw if package.json is not found', async () => {
    // Arrange
    findNearestPackageJsonMock.mockResolvedValue(null);

    // Act & Assert
    await expect(getPackageJson(mockStartPath)).rejects.toThrow(ZephyrError);
  });

  it('should throw if package.json cannot be parsed', async () => {
    // Arrange
    findNearestPackageJsonMock.mockResolvedValue({
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

    findNearestPackageJsonMock.mockResolvedValue({
      path: path.join(mockStartPath, 'package.json'),
      json: invalidPackageJson,
    });

    // Act & Assert
    await expect(getPackageJson(mockStartPath)).rejects.toMatchObject({
      code: ZephyrError.toZeCode(ZeErrors.ERR_PACKAGE_JSON_MUST_HAVE_NAME),
      message: `Zephyr needs package.json at ${path.join(
        mockStartPath,
        'package.json'
      )} to have a name field to map your application configuration in deployment.`,
    });
  });

  it('should default version to 0.0.0 and log a warning if version is missing', async () => {
    // Arrange
    const invalidPackageJson = JSON.stringify({
      name: 'test-package',
    });

    findNearestPackageJsonMock.mockResolvedValue({
      path: path.join(mockStartPath, 'package.json'),
      json: invalidPackageJson,
    });

    // Act
    const result = await getPackageJson(mockStartPath);

    // Assert
    expect(result).toEqual({
      name: 'test-package',
      version: '0.0.0',
    });
    expect(logFnMock).toHaveBeenCalledWith(
      'warn',
      `${ZephyrError.toZeCode(ZeErrors.ERR_PACKAGE_JSON_MISSING_VERSION)}: package.json at ${path.join(
        mockStartPath,
        'package.json'
      )} is missing a version field. Zephyr defaulted the version to 0.0.0.`
    );
  });

  it('should not call parseZeDependencies if zephyr:dependencies is undefined', async () => {
    // Arrange
    const packageJsonWithoutZeDeps = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: { 'dep-a': '^1.0.0' },
    };

    findNearestPackageJsonMock.mockResolvedValue({
      path: path.join(mockStartPath, 'package.json'),
      json: JSON.stringify(packageJsonWithoutZeDeps),
    });

    // Act
    const result = await getPackageJson(mockStartPath);

    // Assert
    expect(parseZeDependenciesMock).not.toHaveBeenCalled();
    expect(result).toEqual(packageJsonWithoutZeDeps);
  });

  it('should not warn when version exists', async () => {
    await getPackageJson(mockStartPath);

    expect(logFnMock).not.toHaveBeenCalledWith(
      'warn',
      expect.stringContaining(
        ZephyrError.toZeCode(ZeErrors.ERR_PACKAGE_JSON_MISSING_VERSION)
      )
    );
  });
});
