import { cp, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readDirRecursive, readDirRecursiveWithContents } from './read-dir-recursive';

const FIXTURE_ROOT = resolve(__dirname, '__fixtures__/read-dir-recursive');

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

async function createDirSymlink(targetPath: string, linkPath: string): Promise<void> {
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  const linkTarget = process.platform === 'win32' ? resolve(targetPath) : targetPath;
  await symlink(linkTarget, linkPath, type);
}

async function createFileSymlink(targetPath: string, linkPath: string): Promise<void> {
  if (process.platform === 'win32') {
    await symlink(resolve(targetPath), linkPath, 'file');
    return;
  }

  await symlink(targetPath, linkPath);
}

function isSymlinkPermissionError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'EPERM' || code === 'EACCES' || code === 'UNKNOWN';
}

describe('read-dir-recursive', () => {
  let tempRoot = '';
  let symlinkSupported = true;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'zephyr-read-dir-'));
    await cp(FIXTURE_ROOT, tempRoot, { recursive: true });

    symlinkSupported = true;
    try {
      await createDirSymlink(join(tempRoot, 'c'), join(tempRoot, 'a', 'b'));
      await createFileSymlink(
        join(tempRoot, 'c', 'd.txt'),
        join(tempRoot, 'a', 'd-link.txt')
      );
    } catch (error) {
      if (isSymlinkPermissionError(error)) {
        symlinkSupported = false;
        return;
      }

      throw error;
    }
  });

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('preserves nested relative paths from the original root', async () => {
    const files = await readDirRecursive(join(tempRoot, 'a'));
    const relativePaths = files.map((file) => normalizePath(file.relativePath));

    expect(relativePaths).toEqual(
      expect.arrayContaining(['local.txt', 'nested/inner.txt'])
    );
    expect(relativePaths).not.toContain('inner.txt');
  });

  it('resolves symlinked directory contents under the symlink path', async () => {
    if (!symlinkSupported) {
      return;
    }

    const files = await readDirRecursiveWithContents(join(tempRoot, 'a'));
    const symlinkedEntry = files.find(
      (file) => normalizePath(file.relativePath) === 'b/d.txt'
    );
    const resolvedTarget = await realpath(join(tempRoot, 'c', 'd.txt'));

    expect(symlinkedEntry).toBeDefined();
    expect(normalizePath(symlinkedEntry?.fullPath || '')).toBe(
      normalizePath(resolvedTarget)
    );
    expect(symlinkedEntry?.content.toString('utf-8').trim()).toBe(
      'symlink target fixture'
    );
  });

  it('resolves symlinked files under the symlink alias path', async () => {
    if (!symlinkSupported) {
      return;
    }

    const files = await readDirRecursiveWithContents(join(tempRoot, 'a'));
    const linkedFile = files.find(
      (file) => normalizePath(file.relativePath) === 'd-link.txt'
    );

    expect(linkedFile).toBeDefined();
    expect(linkedFile?.content.toString('utf-8').trim()).toBe('symlink target fixture');
  });

  it('skips common junk and vcs paths', async () => {
    const files = await readDirRecursive(join(tempRoot, 'a'));
    const relativePaths = files.map((file) => normalizePath(file.relativePath));

    expect(relativePaths.some((path) => path.includes('node_modules'))).toBe(false);
    expect(relativePaths.some((path) => path.includes('.git'))).toBe(false);
    expect(relativePaths).not.toContain('.DS_Store');
    expect(relativePaths).not.toContain('Thumbs.db');
  });

  it('guards against recursive symlink loops', async () => {
    if (!symlinkSupported) {
      return;
    }

    await createDirSymlink(join(tempRoot, 'a'), join(tempRoot, 'a', 'loop'));

    const files = await readDirRecursive(join(tempRoot, 'a'));
    const relativePaths = files.map((file) => normalizePath(file.relativePath));

    expect(relativePaths).toEqual(
      expect.arrayContaining(['local.txt', 'nested/inner.txt', 'b/d.txt'])
    );
    expect(relativePaths.some((path) => path.startsWith('loop/'))).toBe(false);
  });
});
