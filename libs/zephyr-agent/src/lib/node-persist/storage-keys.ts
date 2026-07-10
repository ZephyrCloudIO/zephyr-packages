import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { redactString } from '../security/redaction';

export const ZE_PATH = path.resolve(os.homedir(), '.zephyr');
export const ZE_STORAGE_PATH = path.resolve(ZE_PATH, 'storage');
export const ZE_SESSION_LOCK = path.resolve(ZE_PATH, 'session');

/** Apply POSIX owner-only permissions without weakening Windows profile ACLs. */
export function ensurePrivateFilePermissions(filePath: string): void {
  if (process.platform === 'win32') return;

  const stat = fs.lstatSync(filePath);
  if (!stat.isFile()) {
    throw new TypeError(`Refusing to apply private file permissions to ${filePath}`);
  }
  fs.chmodSync(filePath, 0o600);
}

/**
 * Create the Zephyr persistence boundary and remediate artifacts created by older
 * versions which inherited group/world-readable modes from the process umask.
 */
export function ensurePrivateStoragePermissions(
  zephyrPath = ZE_PATH,
  storagePath = ZE_STORAGE_PATH,
  sessionPath = ZE_SESSION_LOCK
): void {
  fs.mkdirSync(zephyrPath, { recursive: true, mode: 0o700 });
  fs.mkdirSync(storagePath, { recursive: true, mode: 0o700 });

  if (process.platform === 'win32') return;

  // mkdir's mode only applies to newly created directories; chmod remediates existing
  // installations as well.
  fs.chmodSync(zephyrPath, 0o700);
  fs.chmodSync(storagePath, 0o700);

  for (const entry of fs.readdirSync(storagePath, { withFileTypes: true })) {
    if (entry.isFile()) {
      ensurePrivateFilePermissions(path.join(storagePath, entry.name));
    }
  }

  if (fs.existsSync(sessionPath)) {
    ensurePrivateFilePermissions(sessionPath);
  }
}

try {
  // Dedicated node-persist directory to avoid clashes with other .zephyr assets (logs,
  // etc). Existing credential-bearing artifacts are made private during initialization.
  ensurePrivateStoragePermissions();
} catch (error) {
  console.error(
    'error',
    `Could not secure ~/.zephyr storage. Please check your permissions.`,
    redactString(error instanceof Error ? error.message : String(error))
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
  ze_server_token = 'ZE_SERVER_TOKEN',
  ze_ci_token = 'ZE_CI_TOKEN',
  ze_user_email = 'ZE_USER_EMAIL',
}
