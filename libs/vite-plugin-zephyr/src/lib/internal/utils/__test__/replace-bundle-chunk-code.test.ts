import { replaceBundleChunkCode } from '../replace-bundle-chunk-code';

describe('replaceBundleChunkCode', () => {
  it('replaces read-only chunk code by swapping the bundle entry', () => {
    const bundle: Record<string, unknown> = {};
    const chunk = { fileName: 'entry.js', type: 'chunk' as const };
    const code = 'console.log("before");';

    Object.defineProperty(chunk, 'code', {
      configurable: true,
      enumerable: true,
      get: () => code,
    });

    bundle['entry.js'] = chunk;

    expect(() => {
      (chunk as { code: string }).code = 'console.log("after");';
    }).toThrow(/getter/);

    const replacedChunk = replaceBundleChunkCode(
      bundle,
      'entry.js',
      chunk as typeof chunk & { code: string },
      'console.log("after");'
    );

    expect(replacedChunk).toEqual({
      fileName: 'entry.js',
      type: 'chunk',
      code: 'console.log("after");',
    });
    expect(bundle['entry.js']).toEqual(replacedChunk);
    expect(chunk.code).toBe('console.log("before");');
  });
});
