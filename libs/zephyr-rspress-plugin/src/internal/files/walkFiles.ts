import { readDirRecursive, type ZephyrBuildTarget } from 'zephyr-agent';
import { join } from 'node:path';

/**
 * Lists emitted Rspress assets using package-relative POSIX keys. TAP artifacts may
 * intentionally live in paths normally ignored by conventional web deployments, and an
 * unreadable locked artifact must fail the build rather than disappear from a snapshot.
 */
export async function walkFiles(
  dir: string,
  prefix = '',
  target?: ZephyrBuildTarget
): Promise<string[]> {
  const files =
    target === 'tap-app'
      ? await readDirRecursive(dir, {
          includeIgnoredPaths: true,
          failOnError: true,
        })
      : await readDirRecursive(dir);

  return files.map((file) =>
    (prefix ? join(prefix, file.relativePath) : file.relativePath).replace(/\\/g, '/')
  );
}
