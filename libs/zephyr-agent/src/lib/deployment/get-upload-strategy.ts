import type { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { ZeErrors, ZephyrError } from '../errors';
import { UploadProviderType } from '../node-persist/upload-provider-options';
import { cloudflareStrategy, fastlyStrategy, netlifyStrategy } from './index';

type UploadStrategy = (
  zephyr_engine: ZephyrEngine,
  upload_options: UploadOptions
) => Promise<string>;

export function getUploadStrategy(platform: UploadProviderType): UploadStrategy {
  switch (platform) {
    case UploadProviderType.CLOUDFLARE:
      return cloudflareStrategy;
    case UploadProviderType.NETLIFY:
      return netlifyStrategy;
    case UploadProviderType.FASTLY:
      return fastlyStrategy;
    default:
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: 'Unsupported upload provider.',
        data: {
          platform,
        },
      });
  }
}
