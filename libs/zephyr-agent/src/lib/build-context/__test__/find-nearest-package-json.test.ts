import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { describe, expect, jest } from '@jest/globals';
import { find_nearest_package_json } from '../find-nearest-package-json';

// Mocking the functions for testing
jest.mock('node:fs', () => {
  const actualFs = jest.requireActual('node:fs');
  return {
    // @ts-expect-error can't destruct this import
    ...actualFs,
    accessSync: jest.fn().mockImplementation(() => new Error('unexpected call to mock')),
  };
});

// Mocking the functions for testing
jest.mock('node:fs/promises', () => {
  const actualFs = jest.requireActual('node:fs');
  return {
    // @ts-expect-error can't destruct this import
    ...actualFs,
    readFile: jest
      .fn()
      .mockImplementation(() => Promise.reject(new Error('unexpected call to mock'))),
  };
});

describe('libs/zephyr-agent/src/webpack-plugin/context-lifecycle-events/find-nearest-package-json.ts', () => {
  const access_mock = fs.accessSync as jest.Mock<typeof fs.accessSync>;
  const read_file_mock = fsp.readFile as jest.Mock<typeof fsp.readFile>;

  beforeEach(() => {
    access_mock.mockReset();
    read_file_mock.mockReset();
  });

  it('should throw without params', async () => {
    await expect(find_nearest_package_json).rejects.toThrow();
  });

  it('should return void with empty path', async () => {
    await expect(() => find_nearest_package_json('')).rejects.toThrow();
  });

  it('should throw with a non-existent path', async () => {
    access_mock.mockImplementation(() => {
      throw new Error('Not found');
    });

    await expect(find_nearest_package_json('/fake/path')).rejects.toThrow('ZE10010');
  });

  it('should return the path and content of the nearest package.json', async () => {
    const fakePath = '/fake/path/to';
    const packageJsonPath = '/fake/path/to/package.json';
    const packageJsonContent = '{ "name": "fake", "version": "1.1.1" }';

    access_mock.mockImplementationOnce((path) => {
      if (path === packageJsonPath) {
        return;
      }
    });

    read_file_mock.mockReturnValueOnce(Promise.resolve(packageJsonContent));

    const result = await find_nearest_package_json(fakePath);
    expect(result).toBeDefined();
    expect(result?.path).toBe(packageJsonPath);
    expect(result?.json).toBe(packageJsonContent);
  });

  it('should return the path and content of package.json two folders above', async () => {
    const fakePath = '/fake/path/to/deeper';
    const packageJsonPath = '/fake/path/package.json';
    const packageJsonContent = '{ "name": "fake", "version": "1.1.1" }';

    access_mock.mockImplementation((path) => {
      if (path === packageJsonPath) {
        return;
      } else {
        throw new Error('Not found');
      }
    });

    read_file_mock.mockReturnValueOnce(Promise.resolve(packageJsonContent));

    const result = await find_nearest_package_json(fakePath);
    expect(result).toBeDefined();
    expect(result?.path).toBe(packageJsonPath);
    expect(result?.json).toBe(packageJsonContent);
  });

  it('should throw when no package.json is found after multiple levels', async () => {
    const fakePath = '/fake/path/to/deeper';

    access_mock.mockImplementation(() => {
      throw new Error('Not found');
    });

    await expect(find_nearest_package_json(fakePath)).rejects.toThrow('ZE10010');
  });
});
