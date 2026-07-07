import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../zephyr-engine';
import { ze_log } from '../logging';

const ORIGIN_ABSOLUTE_URL_REGEX = /(?:src|href)\s*=\s*["']\/(?!\/)[^"']*["']/gi;
const MAX_REPORTED_URLS = 10;

/**
 * Path-addressed applications are served under a URL prefix (`/__zephyr/v1/...`), so
 * origin-absolute URLs baked into HTML resolve outside the prefix and 404. Bundler
 * plugins fix their own defaults (Vite base, webpack/rspack publicPath), but hardcoded
 * absolute references in app HTML are out of their reach — surface them as a build
 * warning so the 404s are not a mystery after deploy.
 *
 * Protocol-relative (`//host/...`) and full URLs are not flagged. This check never fails
 * the build.
 */
export async function warnPathModeAbsoluteUrls(
  zephyr_engine: ZephyrEngine,
  assetsMap: ZeBuildAssetsMap
): Promise<void> {
  try {
    const { ADDRESS_MODE } = await zephyr_engine.application_configuration;
    if (ADDRESS_MODE !== 'path') {
      return;
    }

    const findings: string[] = [];
    for (const asset of Object.values(assetsMap)) {
      if (asset.extname !== '.html') {
        continue;
      }

      const html =
        typeof asset.buffer === 'string' ? asset.buffer : asset.buffer.toString('utf8');
      const matches = html.match(ORIGIN_ABSOLUTE_URL_REGEX);
      if (!matches) {
        continue;
      }

      for (const match of matches) {
        findings.push(`  - ${asset.path}: ${match}`);
      }
    }

    if (findings.length === 0) {
      return;
    }

    const shown = findings.slice(0, MAX_REPORTED_URLS);
    const hidden = findings.length - shown.length;
    const logger = await zephyr_engine.logger;
    logger({
      level: 'warn',
      action: 'build:warn:path-mode-absolute-urls',
      message: `This application uses path-based addressing, but its HTML references origin-absolute URLs that will not resolve under the deployment path prefix:\n${shown.join('\n')}${hidden > 0 ? `\n  ...and ${hidden} more` : ''}\nUse relative URLs, or a runtime-resolved public path (Vite: base './', webpack/rspack: output.publicPath 'auto').`,
    });
  } catch (error) {
    // A diagnostics check must never break the upload
    ze_log.upload(`Skipped path-mode absolute URL check: ${error}`);
  }
}
