import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { extractAstroAssetsMap } from '../extract-astro-assets-map';

const { buildAssetsMapMock, logFnMock, readDirRecursiveWithContentsMock } =
  rs.hoisted(() => ({
    buildAssetsMapMock: rs.fn(),
    logFnMock: rs.fn(),
    readDirRecursiveWithContentsMock: rs.fn(),
  }));

rs.mock('zephyr-agent', () => {
  return {
    buildAssetsMap: (...args: unknown[]) => buildAssetsMapMock(...args),
    logFn: (...args: unknown[]) => logFnMock(...args),
    readDirRecursiveWithContents: (...args: unknown[]) =>
      readDirRecursiveWithContentsMock(...args),
  };
});

describe('extractAstroAssetsMap', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    buildAssetsMapMock.mockImplementation((assets) => {
      const result: Record<string, unknown> = {};
      Object.keys(assets).forEach((key, index) => {
        const hash = `hash${index + 1}`;
        result[hash] = {
          hash,
          content: assets[key].content,
          type: assets[key].type,
          filepath: key,
        };
      });
      return result;
    });
  });

  it('extracts assets from readDirRecursiveWithContents', async () => {
    readDirRecursiveWithContentsMock.mockResolvedValue([
      {
        fullPath: '/dist/index.html',
        relativePath: 'index.html',
        content: Buffer.from('<html><body>Hello</body></html>'),
      },
      {
        fullPath: '/dist/style.css',
        relativePath: 'style.css',
        content: Buffer.from('body { color: red; }'),
      },
      {
        fullPath: '/dist/script.js',
        relativePath: 'script.js',
        content: Buffer.from('console.log("hello");'),
      },
    ]);

    const assetsMap = await extractAstroAssetsMap('/dist');

    expect(Object.keys(assetsMap)).toHaveLength(3);
    expect(readDirRecursiveWithContentsMock).toHaveBeenCalledWith('/dist');
    expect(buildAssetsMapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        'index.html': expect.objectContaining({ type: 'text/html' }),
        'style.css': expect.objectContaining({ type: 'text/css' }),
        'script.js': expect.objectContaining({
          type: 'application/javascript',
        }),
      }),
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('filters skipped files', async () => {
    readDirRecursiveWithContentsMock.mockResolvedValue([
      {
        fullPath: '/dist/index.html',
        relativePath: 'index.html',
        content: Buffer.from('<html></html>'),
      },
      {
        fullPath: '/dist/script.js.map',
        relativePath: 'script.js.map',
        content: Buffer.from('{"version":3}'),
      },
      {
        fullPath: '/dist/.DS_Store',
        relativePath: '.DS_Store',
        content: Buffer.from('meta'),
      },
      {
        fullPath: '/dist/node_modules/pkg/index.js',
        relativePath: 'node_modules/pkg/index.js',
        content: Buffer.from('ignored'),
      },
    ]);

    await extractAstroAssetsMap('/dist');

    expect(buildAssetsMapMock).toHaveBeenCalledWith(
      {
        'index.html': expect.objectContaining({ type: 'text/html' }),
      },
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('logs and returns empty assets when recursive read fails', async () => {
    readDirRecursiveWithContentsMock.mockRejectedValue(
      new Error('Access denied')
    );

    const result = await extractAstroAssetsMap('/dist');

    expect(result).toEqual({});
    expect(buildAssetsMapMock).toHaveBeenCalledWith(
      {},
      expect.any(Function),
      expect.any(Function)
    );
    expect(logFnMock).toHaveBeenCalledWith(
      'warn',
      expect.stringMatching(/Failed to read build directory \/dist/)
    );
  });

  it('exposes extractBuffer and getAssetType callbacks through buildAssetsMap', async () => {
    readDirRecursiveWithContentsMock.mockResolvedValue([
      {
        fullPath: '/dist/test.txt',
        relativePath: 'test.txt',
        content: Buffer.from('test content'),
      },
    ]);

    await extractAstroAssetsMap('/dist');

    const extractBuffer = buildAssetsMapMock.mock.calls[0]?.[1];
    const getAssetType = buildAssetsMapMock.mock.calls[0]?.[2];
    const testAsset = { content: Buffer.from('test'), type: 'text/plain' };

    expect(extractBuffer(testAsset)).toBe(testAsset.content);
    expect(getAssetType(testAsset)).toBe('text/plain');
  });
});
