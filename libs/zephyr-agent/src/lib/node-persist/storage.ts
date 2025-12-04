import { init } from 'node-persist';
import { ZE_PERSIST_PATH } from './storage-keys';

/** @internal */
export const storage = init({
  dir: ZE_PERSIST_PATH,
});
