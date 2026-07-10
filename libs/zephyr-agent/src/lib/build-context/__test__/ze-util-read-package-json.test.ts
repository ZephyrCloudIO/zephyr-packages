import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

import fs from 'node:fs';
import path from 'node:path';
import { ZeErrors, ZephyrError } from '../../errors';
import { find_nearest_package_json } from '../find-nearest-package-json';
import type { ZeDependency } from '../ze-package-json.type';
import { parseZeDependencies } from '../ze-util-parse-ze-dependencies';
import { getPackageJson } from '../ze-util-read-package-json';
import { logFn } from '../../logging/ze-log-event';

// Mock dependencies
rs.mock('node:fs', { spy: true });
rs.mock('node:fs/promises', { spy: true });
rs.mock('../find-nearest-package-json', { spy: true });
rs.mock('../ze-util-parse-ze-dependencies', { spy: true });
rs.mock('../../logging', () => ({
  ze_log: { package: rs.fn(), misc: rs.fn(), error: rs.fn() },
}));
rs.mock('../../logging/ze-log-event', () => ({ logFn: rs.fn() }));

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
    rs.resetAllMocks();

    // Setup default mocks
    (fs.statSync as Mock).mockReturnValue({ isFile: () => false });
    (find_nearest_package_json as Mock).mockResolvedValue({
      path: path.join(mockStartPath, 'package.json'),
      json: mockPackageJsonStr,
    });
    (parseZeDependencies as Mock).mockReturnValue(mockParsedZeDeps);
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

  it('merges config remotes over package remotes before parsing', async () => {
    await getPackageJson(mockStartPath, {
      remoteDependencies: {
        'ze-dep': 'zephyr:configured.project.org@latest',
        'config-only': 'zephyr:config-only.project.org@next',
      },
    });

    expect(parseZeDependencies).toHaveBeenCalledWith({
      'ze-dep': 'zephyr:configured.project.org@latest',
      'config-only': 'zephyr:config-only.project.org@next',
    });
  });

  it('should handle file paths by moving up one directory', async () => {
    // Arrange
    (fs.statSync as Mock).mockReturnValue({ isFile: () => true });
    const expectedPath = path.resolve(mockStartPath, '..');

    // Act
    await getPackageJson(mockStartPath);

    // Assert
    expect(find_nearest_package_json).toHaveBeenCalledWith(expectedPath);
  });

  it('should use cwd if no path is provided', async () => {
    // Arrange
    const cwd = '/current/working/dir';
    rs.spyOn(process, 'cwd').mockReturnValue(cwd);

    // Act
    await getPackageJson(undefined);

    // Assert
    expect(find_nearest_package_json).toHaveBeenCalledWith(cwd);
  });

  it('should throw if package.json is not found', async () => {
    // Arrange
    (find_nearest_package_json as Mock).mockResolvedValue(null);

    // Act & Assert
    await expect(getPackageJson(mockStartPath)).rejects.toThrow(ZephyrError);
  });

  it('should throw if package.json cannot be parsed', async () => {
    // Arrange
    (find_nearest_package_json as Mock).mockResolvedValue({
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

    (find_nearest_package_json as Mock).mockResolvedValue({
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

    (find_nearest_package_json as Mock).mockResolvedValue({
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
    expect(logFn).toHaveBeenCalledWith(
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

    (find_nearest_package_json as Mock).mockResolvedValue({
      path: path.join(mockStartPath, 'package.json'),
      json: JSON.stringify(packageJsonWithoutZeDeps),
    });

    // Act
    const result = await getPackageJson(mockStartPath);

    // Assert
    expect(parseZeDependencies).not.toHaveBeenCalled();
    expect(result).toEqual(packageJsonWithoutZeDeps);
  });

  it('should not warn when version exists', async () => {
    await getPackageJson(mockStartPath);

    expect(logFn).not.toHaveBeenCalledWith(
      'warn',
      expect.stringContaining(
        ZephyrError.toZeCode(ZeErrors.ERR_PACKAGE_JSON_MISSING_VERSION)
      )
    );
  });
});
