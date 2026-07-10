import { replaceBundleChunkCode } from '../replace-bundle-chunk-code';

describe('replaceBundleChunkCode', () => {
  it('mutates a Rolldown chunk proxy without assigning to the bundle proxy', () => {
    const originalCode = 'console.log("before");';
    const nextCode = 'console.log("after");';
    const cachedProperties = new Map<PropertyKey, unknown>();
    const updatedFiles = new Set<string>();
    let bundleAssignments = 0;

    const chunkTarget = {
      fileName: 'entry.js',
      type: 'chunk' as const,
      get code() {
        return originalCode;
      },
    };
    const chunk = new Proxy(chunkTarget, {
      get(target, property, receiver) {
        return cachedProperties.has(property)
          ? cachedProperties.get(property)
          : Reflect.get(target, property, receiver);
      },
      set(_target, property, value) {
        cachedProperties.set(property, value);
        updatedFiles.add(chunkTarget.fileName);
        return true;
      },
    }) as typeof chunkTarget & { code: string };
    const bundle = new Proxy<Record<string, typeof chunk>>(
      { 'entry.js': chunk },
      {
        set() {
          bundleAssignments += 1;
          return true;
        },
      }
    );

    const replacedChunk = replaceBundleChunkCode(bundle['entry.js'], nextCode);

    expect(replacedChunk).toBe(chunk);
    expect(bundle['entry.js']).toBe(chunk);
    expect(chunk.code).toBe(nextCode);
    expect(updatedFiles).toEqual(new Set(['entry.js']));
    expect(bundleAssignments).toBe(0);
  });
});
