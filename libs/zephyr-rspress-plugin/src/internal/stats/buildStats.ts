import type { Stats } from '../../types/index.js';

export function buildStats(root: string, files: string[]): Stats {
  return {
    compilation: {
      options: {
        context: root,
      },
    },
    toJson: () => ({
      assets: files.map((name) => ({ name })),
    }),
  };
}
