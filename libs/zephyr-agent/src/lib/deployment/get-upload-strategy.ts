import { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
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
      return commonUploadStrategy;
    default:
      throw new Error('Unsupported upload provider.');
  }
}
