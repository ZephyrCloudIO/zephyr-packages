import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../zephyr-engine';
import { ze_log } from '../logging';
import { usesPathAddressing } from './address-mode';

const TAG_ATTRIBUTE_REGEX = /<[a-z][^>]*?\b(src|href)\s*=\s*(["'])(\/(?!\/)[^"']*)\2/gi;
const MAX_REPORTED_URLS = 10;
const MAX_REPORTED_URL_LENGTH = 240;

function truncateUrl(url: string): string {
  return url.length <= MAX_REPORTED_URL_LENGTH
    ? url
    : `${url.slice(0, MAX_REPORTED_URL_LENGTH)}…`;
}

/**
 * Warn about HTML references which escape a path-addressed deployment prefix. This is a
 * diagnostic only: framework output can contain intentional application routes, so it
 * must never fail an otherwise valid publication.
 */
export async function warnPathModeAbsoluteUrls(
  zephyrEngine: ZephyrEngine,
  assetsMap: ZeBuildAssetsMap
): Promise<void> {
  try {
    if (!usesPathAddressing(await zephyrEngine.application_configuration)) {
      return;
    }

    const findings: string[] = [];
    let findingCount = 0;

    for (const asset of Object.values(assetsMap)) {
      if (asset.extname.toLowerCase() !== '.html') {
        continue;
      }

      const html =
        typeof asset.buffer === 'string' ? asset.buffer : asset.buffer.toString('utf8');
      TAG_ATTRIBUTE_REGEX.lastIndex = 0;
      for (const match of html.matchAll(TAG_ATTRIBUTE_REGEX)) {
        findingCount += 1;
        if (findings.length < MAX_REPORTED_URLS) {
          findings.push(
            `  - ${asset.path}: ${match[1]?.toLowerCase()}="${truncateUrl(match[3] ?? '')}"`
          );
        }
      }
    }

    if (findingCount === 0) {
      return;
    }

    const hidden = findingCount - findings.length;
    const logger = await zephyrEngine.logger;
    logger({
      level: 'warn',
      action: 'build:warn:path-mode-absolute-urls',
      message: `This build targets path-based addressing, but its HTML references origin-absolute URLs that escape the deployment prefix:\n${findings.join('\n')}${hidden > 0 ? `\n  ...and ${hidden} more` : ''}\nUse relative URLs or a runtime-resolved public path (Vite: base './'; webpack/rspack: output.publicPath 'auto').`,
    });
  } catch {
    // Diagnostics must never block an upload, including when configuration/logging is
    // temporarily unavailable.
    ze_log.upload('Skipped path-mode absolute URL diagnostics.');
  }
}
