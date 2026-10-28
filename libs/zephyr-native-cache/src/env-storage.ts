import type { ZephyrNativeEnvStorage } from 'zephyr-edge-contract';
import NativeMFECache from './NativeMFECache';

/**
 * File-backed ZephyrNativeEnvStorage over the MFECache native module; undefined when it
 * is not linked.
 */
export function createNativeEnvStorage(): ZephyrNativeEnvStorage | undefined {
  const native = NativeMFECache;
  if (!native) return undefined;

  const filePath = async (key: string) =>
    `${await native.getDocumentDirectory()}/zephyr-env-${await native.sha256String(key)}.json`;

  return {
    async getItem(key) {
      const file = await filePath(key);
      if (!(await native.fileExists(file))) return undefined;
      return native.readFile(file, 'utf8');
    },
    async setItem(key, value) {
      const file = await filePath(key);
      await native.writeFile(file, value, 'utf8');
    },
  };
}
