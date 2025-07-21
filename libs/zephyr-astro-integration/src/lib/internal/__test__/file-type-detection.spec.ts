// Separate test file for detailed file type detection testing
// This tests the getFileType logic without requiring file system operations

// We need to extract the getFileType function for direct testing
// Let's test it by examining the behavior through extractAstroAssetsMap

import { extractAstroAssetsMap } from '../extract-astro-assets-map';
import { buildAssetsMap } from 'zephyr-agent';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

jest.mock('zephyr-agent', () => ({
  buildAssetsMap: jest.fn(),
}));

describe('File Type Detection', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `file-type-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    
    (buildAssetsMap as jest.Mock).mockImplementation((assets) => {
      return Object.fromEntries(
        Object.entries(assets).map(([key, value], index) => [
          `hash${index}`,
          { filepath: key, ...(value as any) }
        ])
      );
    });
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    jest.clearAllMocks();
  });

  const testCases = [
    // Web files
    ['index.html', 'text/html'],
    ['INDEX.HTML', 'text/html'], // Case insensitive
    ['style.css', 'text/css'],
    ['script.js', 'application/javascript'],
    ['module.mjs', 'application/javascript'],
    
    // Data files
    ['data.json', 'application/json'],
    ['config.xml', 'text/xml'],
    ['readme.txt', 'text/plain'],
    
    // Images
    ['logo.png', 'image/png'],
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['animation.gif', 'image/gif'],
    ['icon.svg', 'image/svg+xml'],
    ['favicon.ico', 'image/x-icon'],
    
    // Fonts
    ['font.woff', 'font/woff'],
    ['font.woff2', 'font/woff2'],
    ['font.ttf', 'font/ttf'],
    ['font.eot', 'application/vnd.ms-fontobject'],
    
    // Unknown/fallback
    ['unknown.xyz', 'application/octet-stream'],
    ['no-extension', 'application/octet-stream'],
    ['file.', 'application/octet-stream'],
  ];

  test.each(testCases)('should detect %s as %s', async (filename, expectedType) => {
    await writeFile(join(tempDir, filename), 'test content');
    
    await extractAstroAssetsMap(tempDir);
    
    const buildAssetsMapCall = (buildAssetsMap as jest.Mock).mock.calls[0];
    const assets = buildAssetsMapCall[0];
    
    expect(assets[filename]).toHaveProperty('type', expectedType);
  });

  it('should handle files with multiple extensions correctly', async () => {
    const testFiles = [
      ['script.min.js', 'application/javascript'],
      ['style.min.css', 'text/css'],
      ['backup.tar.gz', 'application/octet-stream'], // Should use last extension
      ['data.test.json', 'application/json'],
    ];

    for (const [filename] of testFiles) {
      await writeFile(join(tempDir, filename), 'content');
    }

    await extractAstroAssetsMap(tempDir);
    
    const buildAssetsMapCall = (buildAssetsMap as jest.Mock).mock.calls[0];
    const assets = buildAssetsMapCall[0];
    
    testFiles.forEach(([filename, expectedType]) => {
      expect(assets[filename]).toHaveProperty('type', expectedType);
    });
  });
});