type ChunkWithCode = {
  code: string;
};

export function replaceBundleChunkCode<T extends ChunkWithCode>(
  bundle: Record<string, unknown>,
  fileName: string,
  chunk: T,
  nextCode: string
): T {
  const nextChunk = {
    ...chunk,
    code: nextCode,
  };

  bundle[fileName] = nextChunk;
  return nextChunk;
}
