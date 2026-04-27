import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizePath, resolveEntrypoint } from './paths';

describe('resolveEntrypoint', () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'zephyr-nuxt-paths-'));
    await mkdir(join(outputDir, 'server'), { recursive: true });
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it('returns undefined when no known entrypoint exists', async () => {
    await expect(resolveEntrypoint(outputDir)).resolves.toBeUndefined();
  });

  it('prefers server/index.mjs over other candidates', async () => {
    await writeFile(join(outputDir, 'server/index.js'), 'js');
    await writeFile(join(outputDir, 'server/index.mjs'), 'mjs');

    await expect(resolveEntrypoint(outputDir)).resolves.toBe(
      'server/index.mjs'
    );
  });

  it('falls back to server/index.js when mjs is missing', async () => {
    await writeFile(join(outputDir, 'server/index.js'), 'js');

    await expect(resolveEntrypoint(outputDir)).resolves.toBe('server/index.js');
  });

  it('normalizes explicit absolute entrypoint to output-relative path', async () => {
    const absoluteEntrypoint = join(outputDir, 'server/index.cjs');

    await expect(
      resolveEntrypoint(outputDir, absoluteEntrypoint)
    ).resolves.toBe('server/index.cjs');
  });

  it('normalizes separator variants for explicit entrypoint', async () => {
    await expect(
      resolveEntrypoint(outputDir, '.\\server\\index.mjs')
    ).resolves.toBe('server/index.mjs');
    expect(normalizePath('server\\index.mjs')).toBe('server/index.mjs');
  });
});
