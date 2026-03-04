import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, rs } from '@rstest/core';
import { find_nearest_package_json } from '../find-nearest-package-json';
import { ZeErrors, ZephyrError } from '../../errors';

describe('libs/zephyr-agent/src/webpack-plugin/context-lifecycle-events/find-nearest-package-json.ts', () => {
  let tempRoots: string[] = [];

  beforeEach(() => {
    tempRoots = [];
  });

  afterEach(async () => {
    await Promise.all(
      tempRoots.map((root) => rm(root, { recursive: true, force: true }))
    );
  });

  const createTempRoot = async () => {
    const root = await mkdtemp(join(tmpdir(), 'zephyr-find-nearest-'));
    tempRoots.push(root);
    return root;
  };

  it('should throw without params', async () => {
    await expect(find_nearest_package_json as unknown as () => Promise<unknown>).rejects.toThrow();
  });

  it('should return void with empty path', async () => {
    await expect(() => find_nearest_package_json('')).rejects.toThrow();
  });

  it('should throw with a non-existent path', async () => {
    const root = await createTempRoot();
    const fakePath = join(root, 'missing', 'path');

    await expect(find_nearest_package_json(fakePath)).rejects.toThrow(
      new ZephyrError(ZeErrors.ERR_PACKAGE_JSON_NOT_FOUND)
    );
  });

  it('should return the path and content of the nearest package.json', async () => {
    const root = await createTempRoot();
    const fakePath = join(root, 'path', 'to');
    await mkdir(fakePath, { recursive: true });

    const packageJsonPath = join(fakePath, 'package.json');
    const packageJsonContent = '{ "name": "fake", "version": "1.1.1" }';
    await writeFile(packageJsonPath, packageJsonContent, 'utf8');

    const result = await find_nearest_package_json(fakePath);
    expect(result).toBeDefined();
    expect(result?.path).toBe(packageJsonPath);
    expect(result?.json).toBe(packageJsonContent);
  });

  it('should return the path and content of package.json two folders above', async () => {
    const root = await createTempRoot();
    const fakePath = join(root, 'path', 'to', 'deeper');
    await mkdir(fakePath, { recursive: true });

    const packageJsonPath = join(root, 'path', 'package.json');
    const packageJsonContent = '{ "name": "fake", "version": "1.1.1" }';
    await writeFile(packageJsonPath, packageJsonContent, 'utf8');

    const result = await find_nearest_package_json(fakePath);
    expect(result).toBeDefined();
    expect(result?.path).toBe(packageJsonPath);
    expect(result?.json).toBe(packageJsonContent);
  });

  it('should throw when no package.json is found after multiple levels', async () => {
    const root = await createTempRoot();
    const fakePath = join(root, 'path', 'to', 'deeper');
    await mkdir(fakePath, { recursive: true });

    await expect(find_nearest_package_json(fakePath)).rejects.toThrow(
      new ZephyrError(ZeErrors.ERR_PACKAGE_JSON_NOT_FOUND)
    );
  });
});
