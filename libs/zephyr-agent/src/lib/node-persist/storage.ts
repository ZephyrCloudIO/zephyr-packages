import nodePersist from 'node-persist';
import { ensurePrivateFilePermissions, ZE_STORAGE_PATH } from './storage-keys';

/** @internal */
export const storage = nodePersist.init({
  dir: ZE_STORAGE_PATH,
  // Continue reading stores created by older releases even when one record was
  // interrupted. Non-node-persist coordination files live outside this directory.
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
