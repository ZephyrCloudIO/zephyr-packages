import type { NextStaticFileOutput } from './types';

export interface CollectedStaticAssets {
  /** Snapshot path (no leading slash) to absolute file path. */
  files: Record<string, string>;
  /** URL pathname of a file that only exists for this build ID. */
  probe: string | undefined;
}

/**
 * Picks the files the browser loads from `/_next/static`. Prerendered HTML and `public/`
 * files stay with the Next.js server, which keeps rendering every page.
 */
export function collectStaticAssets(
  staticFiles: readonly NextStaticFileOutput[],
  basePath: string,
  buildId: string
): CollectedStaticAssets {
  const staticPrefix = `${basePath}/_next/static/`;
  const buildIdPrefix = `${staticPrefix}${buildId}/`;
  const files: Record<string, string> = {};
  let probe: string | undefined;

  for (const { pathname, filePath } of staticFiles) {
    if (!pathname.startsWith(staticPrefix) || pathname.endsWith('.map')) {
      continue;
    }
    files[pathname.slice(1)] = filePath;
    if (!probe && pathname.startsWith(buildIdPrefix)) {
      probe = pathname;
    }
  }

  return { files, probe };
}
