import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { lockSync } from 'proper-lockfile';
import { redactString } from '../security/redaction';

export const ZE_PATH = path.resolve(os.homedir(), '.zephyr');
export const ZE_STORAGE_PATH = path.resolve(ZE_PATH, 'storage');
export const ZE_LOCKS_PATH = path.resolve(ZE_PATH, 'locks');
export const ZE_SESSION_LOCK = path.resolve(ZE_PATH, 'session');
export const PARTIAL_ASSET_LOCK_STALE_MS = 30_000;

const LEGACY_PARTIAL_ASSET_LOCK_TARGET = /^partial-assets-[a-f0-9]{64}$/;

/** Apply POSIX owner-only permissions without weakening Windows profile ACLs. */
export function ensurePrivateFilePermissions(filePath: string): void {
  if (process.platform === 'win32') return;

  const stat = fs.lstatSync(filePath);
  if (!stat.isFile()) {
    throw new TypeError(`Refusing to apply private file permissions to ${filePath}`);
  }
  fs.chmodSync(filePath, 0o600);
}

function secureExistingPrivateFile(filePath: string): void {
  try {
    ensurePrivateFilePermissions(filePath);
  } catch (error) {
    // Storage records can expire or be replaced while another compiler process is
    // remediating an existing installation. A vanished file no longer needs chmod.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

/**
 * Create the Zephyr persistence boundary and remediate artifacts created by older
 * versions which inherited group/world-readable modes from the process umask.
 */
export function ensurePrivateStoragePermissions(
  zephyrPath = ZE_PATH,
  storagePath = ZE_STORAGE_PATH,
  sessionPath = ZE_SESSION_LOCK,
  locksPath = path.resolve(zephyrPath, 'locks')
): void {
  fs.mkdirSync(zephyrPath, { recursive: true, mode: 0o700 });
  fs.mkdirSync(storagePath, { recursive: true, mode: 0o700 });
  fs.mkdirSync(locksPath, { recursive: true, mode: 0o700 });

  // Atomic partial-build stores briefly used empty proper-lockfile targets inside the
  // node-persist data directory. node-persist exposes each empty file as an undefined
  // key, which breaks older readers before they can inspect deployment records. Remove
  // only inactive targets with the exact generated name. Acquiring the legacy lock
  // preserves live older processes while allowing proper-lockfile to recover a stale
  // crash artifact using the same threshold as the original implementation.
  for (const entry of fs.readdirSync(storagePath, { withFileTypes: true })) {
    if (!entry.isFile() || !LEGACY_PARTIAL_ASSET_LOCK_TARGET.test(entry.name)) {
      continue;
    }
    const targetPath = path.join(storagePath, entry.name);
    let release: (() => void) | undefined;
    try {
      release = lockSync(targetPath, {
        realpath: false,
        retries: 0,
        stale: PARTIAL_ASSET_LOCK_STALE_MS,
      });
      if (fs.statSync(targetPath).size === 0) {
        fs.rmSync(targetPath, { force: true });
      }
    } catch (error) {
      // Concurrent compiler processes initialize this boundary independently. Another
      // process removing the same inactive target is a successful migration.
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ELOCKED') throw error;
    } finally {
      release?.();
    }
  }

  if (process.platform === 'win32') return;

  // mkdir's mode only applies to newly created directories; chmod remediates existing
  // installations as well.
  fs.chmodSync(zephyrPath, 0o700);
  fs.chmodSync(storagePath, 0o700);
  fs.chmodSync(locksPath, 0o700);

  for (const privateDirectory of [storagePath, locksPath]) {
    for (const entry of fs.readdirSync(privateDirectory, { withFileTypes: true })) {
      if (entry.isFile()) {
        secureExistingPrivateFile(path.join(privateDirectory, entry.name));
      }
    }
  }

  secureExistingPrivateFile(sessionPath);
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
