type ChunkWithCode = {
  code: string;
};

export function replaceBundleChunkCode<T extends ChunkWithCode>(
  chunk: T,
  nextCode: string
): T {
  chunk.code = nextCode;
  return chunk;
}
