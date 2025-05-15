import { init } from 'node-persist';
import { ZE_PATH } from './storage-keys';

/** @internal */
export const storage = init({
  dir: ZE_PATH,
  // node-persist thinks every file in .zephyr folder is a JSON valid file,
  // since we use that folder for other purposes too, we need to set this to true
  forgiveParseErrors: true,
});
