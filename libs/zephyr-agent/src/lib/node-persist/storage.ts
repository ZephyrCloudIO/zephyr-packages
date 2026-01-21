import { init } from 'node-persist';
import { ZE_STORAGE_PATH } from './storage-keys';

/** @internal */
export const storage = init({
  dir: ZE_STORAGE_PATH,
  // node-persist thinks every file in its folder is a JSON valid file,
  // since we may colocate non-json files, we need to set this to true
  forgiveParseErrors: true,
});
