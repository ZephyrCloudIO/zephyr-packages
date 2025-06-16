import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const ZE_PATH = path.resolve(os.homedir(), '.zephyr');
export const ZE_SESSION_LOCK = path.resolve(ZE_PATH, 'session');

try {
  // Ensures that the directory exists and lockfile is writable
  console.log('---------------- ZE_PATH: ', ZE_PATH);
  fs.mkdirSync(ZE_PATH, { recursive: true });
} catch (error) {
  console.error(
    'error',
    `Could not create ~/.zephyr directory. Please check your permissions: ${error}`
  );
}

export enum StorageKeys {
  ze_app_partial_asset_map = 'ze_app_partial_asset_map',
  ze_app_config_token = 'ze-application-configuration',
  ze_auth_token = 'ze-auth-token',
  ze_secret_token = 'ZE_SECRET_TOKEN',
  ze_fs_cache = 'ze-fs-cache',
  ze_hash_cache = 'ze-hash-cache',
  ze_app_deploy_result = 'ze-app-deploy-result',
}
