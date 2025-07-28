import type { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { commonUploadStrategy } from './common-upload.strategy';
import { ZeErrors, ZephyrError } from '../errors';

const EDGE_LAMBDA_MAX_BODY_SIZE = 788403; // floor(1024 * 1024 / 1.33), where 1.33 is size overhead of base64 encoding

export async function awsUploadStrategy(
  zephyr_engine: ZephyrEngine,
  uploadOptions: UploadOptions,
): Promise<string> {
  const snapshotSize = Buffer.byteLength(JSON.stringify(uploadOptions.snapshot), 'utf8');
  if (snapshotSize > EDGE_LAMBDA_MAX_BODY_SIZE) {
    const opts = {
      entity_name: 'snapshot',
      entity_size: snapshotSize,
      max_allowed_size: EDGE_LAMBDA_MAX_BODY_SIZE,
    };
    throw new ZephyrError(ZeErrors.ERR_MAX_PAYLOAD_SIZE_EXCEEDED, opts);
  }

  for (const missingAsset of uploadOptions.assets.missingAssets) {
    if (missingAsset.size > EDGE_LAMBDA_MAX_BODY_SIZE) {
      const opts = {
        entity_name: missingAsset.path,
        entity_size: missingAsset.size,
        max_allowed_size: EDGE_LAMBDA_MAX_BODY_SIZE,
      };
      throw new ZephyrError(ZeErrors.ERR_MAX_PAYLOAD_SIZE_EXCEEDED, opts);
    }
  }

  return commonUploadStrategy(zephyr_engine, uploadOptions);
}
