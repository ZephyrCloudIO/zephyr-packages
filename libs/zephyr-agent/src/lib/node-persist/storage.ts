import nodePersist from 'node-persist';
import { ensurePrivateFilePermissions, ZE_STORAGE_PATH } from './storage-keys';

/** @internal */
export const storage = nodePersist.init({
  dir: ZE_STORAGE_PATH,
  // node-persist thinks every file in its folder is a JSON valid file,
  // since we may colocate non-json files, we need to set this to true
  forgiveParseErrors: true,
});

interface NodePersistWriteResult {
  file?: unknown;
}

/** Persist a credential-bearing value and fail if its resulting file is not private. */
export async function setPrivateItem(
  key: string,
  value: unknown,
  options?: { ttl?: number }
): Promise<void> {
  await storage;
  const result = (await nodePersist.setItem(key, value, options)) as
    | NodePersistWriteResult
    | undefined;

  // node-persist returns the written path. Test doubles and future implementations may
  // omit it; the enclosing 0700 storage directory remains the primary access boundary.
  if (typeof result?.file === 'string') {
    ensurePrivateFilePermissions(result.file);
  }
}
