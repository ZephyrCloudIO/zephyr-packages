import type { ZeGitInfo } from '../build-context/ze-util-get-git-info';
import {
  getApplicationConfiguration,
  invalidateApplicationConfigCache,
} from '../edge-requests/get-application-configuration';
import { ZeErrors, ZephyrError } from '../errors';
import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';
import { checkAuth } from './login';

export interface AuthRefreshContext {
  application_uid: string;
  git_config: ZeGitInfo;
}

export function isRetryableAuthError(cause: unknown): boolean {
  return ZephyrError.is(cause, ZeErrors.ERR_AUTH_ERROR);
}

export function isForbiddenAuthError(cause: unknown): boolean {
  return ZephyrError.is(cause, ZeErrors.ERR_AUTH_FORBIDDEN_ERROR);
}

export async function refreshApplicationConfiguration(
  authContext: AuthRefreshContext,
  options?: { edgeUrl?: string }
): Promise<ZeApplicationConfig> {
  await checkAuth(authContext.git_config);
  await invalidateApplicationConfigCache(authContext.application_uid);

  const refreshedConfig = await getApplicationConfiguration({
    application_uid: authContext.application_uid,
  });

  if (!options?.edgeUrl) {
    return refreshedConfig;
  }

  return {
    ...refreshedConfig,
    EDGE_URL: options.edgeUrl,
  };
}

export async function refreshApplicationJwt(
  authContext: AuthRefreshContext,
  options?: { edgeUrl?: string }
): Promise<string> {
  const refreshedConfig = await refreshApplicationConfiguration(authContext, options);
  return refreshedConfig.jwt;
}
