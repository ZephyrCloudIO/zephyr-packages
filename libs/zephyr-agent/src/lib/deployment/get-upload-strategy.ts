import type { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { ZeErrors, ZephyrError } from '../errors';
import { UploadProviderType } from '../node-persist/upload-provider-options';
import { commonUploadStrategy } from './common-upload.strategy';

type UploadStrategy = (
  zephyr_engine: ZephyrEngine,
  upload_options: UploadOptions
) => Promise<string>;

export function getUploadStrategy(platform: UploadProviderType): UploadStrategy {
  switch (platform) {
    case UploadProviderType.CLOUDFLARE:
    case UploadProviderType.NETLIFY:
    case UploadProviderType.FASTLY:
    case UploadProviderType.AKAMAI:
    case UploadProviderType.AWS:
      return commonUploadStrategy;
    default:
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: 'Unsupported upload provider.',
        data: {
          platform,
        },
      });
  }
}
