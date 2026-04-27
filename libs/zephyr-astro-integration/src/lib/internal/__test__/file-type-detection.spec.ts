import { beforeEach, describe, expect, it, rs, test } from '@rstest/core';
import type { buildAssetsMap } from 'zephyr-agent';
import { extractAstroAssetsMap } from '../extract-astro-assets-map';

const { mockBuildAssetsMap, mockReadDirRecursiveWithContents } = rs.hoisted(
  () => ({
    mockBuildAssetsMap: rs.fn(),
    mockReadDirRecursiveWithContents: rs.fn(),
  })
);

rs.mock('zephyr-agent', () => ({
  buildAssetsMap: mockBuildAssetsMap,
  readDirRecursiveWithContents: mockReadDirRecursiveWithContents,
}));

describe('File Type Detection', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockBuildAssetsMap.mockImplementation((assets: Record<string, unknown>) => {
      return Object.fromEntries(
        Object.entries(assets).map(([key, value], index) => [
          `hash${index}`,
          { filepath: key, ...(value as Record<string, unknown>) },
        ])
      ) as unknown as ReturnType<typeof buildAssetsMap>;
    });
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

  test.each(testCases)(
    'should detect %s as %s',
    async (filename, expectedType) => {
      mockReadDirRecursiveWithContents.mockResolvedValue([
        {
          fullPath: `/dist/${filename}`,
          relativePath: filename,
          content: Buffer.from('test content'),
        },
      ]);

      await extractAstroAssetsMap('/dist');

      const assets = mockBuildAssetsMap.mock.calls[0]?.[0] as Record<
        string,
        { type: string }
      >;
      expect(assets[filename]).toHaveProperty('type', expectedType);
    }
  );

  it('handles files with multiple extensions correctly', async () => {
    const testFiles = [
      ['script.min.js', 'application/javascript'],
      ['style.min.css', 'text/css'],
      ['backup.tar.gz', 'application/octet-stream'],
      ['data.test.json', 'application/json'],
    ] as const;

    mockReadDirRecursiveWithContents.mockResolvedValue(
      testFiles.map(([filename]) => ({
        fullPath: `/dist/${filename}`,
        relativePath: filename,
        content: Buffer.from('content'),
      }))
    );

    await extractAstroAssetsMap('/dist');

    const assets = mockBuildAssetsMap.mock.calls[0]?.[0] as Record<
      string,
      { type: string }
    >;
    for (const [filename, expectedType] of testFiles) {
      expect(assets[filename]).toHaveProperty('type', expectedType);
    }
  });
});
