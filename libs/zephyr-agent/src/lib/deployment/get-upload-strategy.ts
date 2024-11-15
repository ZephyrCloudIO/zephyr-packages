import { cloudflareStrategy, fastlyStrategy, netlifyStrategy } from './index';
import { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { UploadProviderType } from '../node-persist/upload-provider-options';

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
      throw new Error('Unsupported upload provider.');
  }
}
