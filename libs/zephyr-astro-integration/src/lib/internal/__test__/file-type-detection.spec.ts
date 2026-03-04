import { rs } from '@rstest/core';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractAstroAssetsMap } from '../extract-astro-assets-map';

const buildAssetsMapMock = rs.fn();

rs.mock('zephyr-agent', () => ({
  buildAssetsMap: (...args: unknown[]) => buildAssetsMapMock(...args),
}));

describe('File Type Detection', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `file-type-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    buildAssetsMapMock.mockImplementation((assets: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(assets).map(([key, value], index) => [
          `hash${index}`,
          { filepath: key, ...(value as Record<string, unknown>) },
        ])
      )
    );
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    rs.clearAllMocks();
  });

  const testCases = [
    ['index.html', 'text/html'],
    ['INDEX.HTML', 'text/html'],
    ['style.css', 'text/css'],
    ['script.js', 'application/javascript'],
    ['module.mjs', 'application/javascript'],
    ['data.json', 'application/json'],
    ['config.xml', 'text/xml'],
    ['readme.txt', 'text/plain'],
    ['logo.png', 'image/png'],
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['animation.gif', 'image/gif'],
    ['icon.svg', 'image/svg+xml'],
    ['favicon.ico', 'image/x-icon'],
    ['font.woff', 'font/woff'],
    ['font.woff2', 'font/woff2'],
    ['font.ttf', 'font/ttf'],
    ['font.eot', 'application/vnd.ms-fontobject'],
    ['unknown.xyz', 'application/octet-stream'],
    ['no-extension', 'application/octet-stream'],
    ['file.', 'application/octet-stream'],
  ];

  test.each(testCases)('should detect %s as %s', async (filename, expectedType) => {
    await writeFile(join(tempDir, filename), 'test content');

    await extractAstroAssetsMap(tempDir);

    const buildAssetsMapCall = buildAssetsMapMock.mock.calls[0];
    const assets = buildAssetsMapCall[0] as Record<string, { type: string }>;

    expect(assets[filename]).toHaveProperty('type', expectedType);
  });

  it('should handle files with multiple extensions correctly', async () => {
    const testFiles = [
      ['script.min.js', 'application/javascript'],
      ['style.min.css', 'text/css'],
      ['backup.tar.gz', 'application/octet-stream'],
      ['data.test.json', 'application/json'],
    ];

    for (const [filename] of testFiles) {
      await writeFile(join(tempDir, filename), 'content');
    }

    await extractAstroAssetsMap(tempDir);

    const buildAssetsMapCall = buildAssetsMapMock.mock.calls[0];
    const assets = buildAssetsMapCall[0] as Record<string, { type: string }>;

    testFiles.forEach(([filename, expectedType]) => {
      expect(assets[filename]).toHaveProperty('type', expectedType);
    });
  });
});
