import { createHash } from 'node:crypto';
import nodePersist from 'node-persist';
import {
  ZE_API_ENDPOINT,
  ZE_ENV,
  ZE_IS_PREVIEW,
  ZEPHYR_API_ENDPOINT,
} from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { StorageKeys } from './storage-keys';
import type { ZeApplicationConfig } from './upload-provider-options';
import { setPrivateItem, storage } from './storage';

const STORED_APPLICATION_CONFIG_VERSION = 2;
const PRINCIPAL_FINGERPRINT_CONTEXT = 'zephyr-application-config-principal\0';

export interface ApplicationConfigStorageScope {
  apiEndpoint: string;
  apiGatewayEndpoint: string;
  environment: string | null;
  preview: boolean;
  principalFingerprint: string;
}

interface StoredApplicationConfig {
  version: typeof STORED_APPLICATION_CONFIG_VERSION;
  applicationUid: string;
  scope: ApplicationConfigStorageScope;
  config: ZeApplicationConfig;
}

function normalizeEndpoint(endpoint: string): string {
  return new URL(endpoint).toString();
}

/** Derive a stable principal identity without retaining the credential itself. */
export function getApplicationConfigPrincipalFingerprint(
  token: string | undefined
): string {
  return createHash('sha256')
    .update(PRINCIPAL_FINGERPRINT_CONTEXT)
    .update(token ?? '<anonymous>')
    .digest('base64url');
}

/** Capture every process setting and principal which can change the returned config. */
export function getApplicationConfigStorageScope(
  token?: string
): ApplicationConfigStorageScope {
  return Object.freeze({
    apiEndpoint: normalizeEndpoint(ZEPHYR_API_ENDPOINT()),
    apiGatewayEndpoint: normalizeEndpoint(ZE_API_ENDPOINT()),
    environment: ZE_ENV()?.trim() || null,
    preview: Boolean(ZE_IS_PREVIEW()),
    principalFingerprint: getApplicationConfigPrincipalFingerprint(token),
  });
}

function scopesMatch(
  left: ApplicationConfigStorageScope,
  right: ApplicationConfigStorageScope
): boolean {
  return (
    left.apiEndpoint === right.apiEndpoint &&
    left.apiGatewayEndpoint === right.apiGatewayEndpoint &&
    left.environment === right.environment &&
    left.preview === right.preview &&
    left.principalFingerprint === right.principalFingerprint
  );
}

function scopeKey(scope: ApplicationConfigStorageScope): string {
  return createHash('sha256').update(JSON.stringify(scope)).digest('base64url');
}

function get_key(application_uid: string, scope: ApplicationConfigStorageScope): string {
  return [StorageKeys.ze_app_config_token, scopeKey(scope), application_uid].join('.');
}

function isStoredApplicationConfig(
  value: unknown,
  application_uid: string,
  scope: ApplicationConfigStorageScope
): value is StoredApplicationConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const stored = value as Partial<StoredApplicationConfig>;
  return Boolean(
    stored.version === STORED_APPLICATION_CONFIG_VERSION &&
    stored.applicationUid === application_uid &&
    stored.scope &&
    scopesMatch(stored.scope, scope) &&
    stored.config &&
    stored.config.application_uid === application_uid
  );
}

export async function saveAppConfig(
  application_uid: string,
  json: ZeApplicationConfig,
  scope = getApplicationConfigStorageScope()
): Promise<void> {
  if (json.application_uid !== application_uid) {
    throw new ZephyrError(ZeErrors.ERR_LOAD_APP_CONFIG, {
      application_uid,
      data: { reason: 'application UID mismatch' },
    });
  }
  await storage;
  const stored: StoredApplicationConfig = {
    version: STORED_APPLICATION_CONFIG_VERSION,
    applicationUid: application_uid,
    scope: { ...scope },
    config: json,
  };
  await setPrivateItem(get_key(application_uid, scope), stored, {
    ttl: 5 * 60 * 1000,
  });
}

export async function getAppConfig(
  application_uid: string,
  scope = getApplicationConfigStorageScope()
): Promise<ZeApplicationConfig | undefined> {
  await storage;
  const stored: unknown = await nodePersist.getItem(get_key(application_uid, scope));
  return isStoredApplicationConfig(stored, application_uid, scope)
    ? stored.config
    : undefined;
}

export async function removeAppConfig(
  application_uid: string,
  scope = getApplicationConfigStorageScope()
): Promise<void> {
  await storage;
  await nodePersist.removeItem(get_key(application_uid, scope));
}
