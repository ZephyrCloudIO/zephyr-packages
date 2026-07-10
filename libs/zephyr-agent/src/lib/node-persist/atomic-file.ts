import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import * as path from 'node:path';

export interface AtomicWriteHooks {
  /** @internal Fault-injection hook used to verify pre-rename crash semantics. */
  beforeRename?: (temporaryPath: string, destinationPath: string) => void | Promise<void>;
}

async function syncDirectory(directory: string): Promise<void> {
  let handle;
  try {
    handle = await open(directory, 'r');
    await handle.sync();
  } catch (error: unknown) {
    // Windows does not consistently allow opening/fsyncing directory handles. The
    // same-directory rename is still atomic there; retain the stronger durability
    // barrier on platforms which support it.
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (!['EACCES', 'EBADF', 'EISDIR', 'EINVAL', 'EPERM'].includes(code ?? '')) {
      throw error;
    }
  } finally {
    await handle?.close();
  }
}

/** Write a complete replacement without ever truncating the last committed file. */
export async function writeFileAtomically(
  destinationPath: string,
  content: string,
  hooks: AtomicWriteHooks = {}
): Promise<void> {
  const directory = path.dirname(destinationPath);
  await mkdir(directory, { recursive: true });
  const temporaryPath = `${destinationPath}.${process.pid}.${randomUUID()}.tmp`;
  let handle;

  try {
    handle = await open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await hooks.beforeRename?.(temporaryPath, destinationPath);
    await rename(temporaryPath, destinationPath);
    await syncDirectory(directory);
  } catch (error: unknown) {
    await handle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}
