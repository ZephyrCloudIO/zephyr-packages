import nodePersist from 'node-persist';
import { getSecretToken } from './secret-token';
import { setPrivateItem, storage } from './storage';
import { StorageKeys } from './storage-keys';
import { makeRequest } from '../http/http-request';
import { getCiToken } from './ci-token';
import { getServerToken } from './server-token';
import { ZE_API_ENDPOINT, ze_api_gateway } from 'zephyr-edge-contract';
import { getUserEmail } from './user-email';
import { ze_log } from '../logging/debug';
import { type ZeGitInfo } from '../build-context/ze-util-get-git-info';
import { type CiTokenIdentity, inferCiTokenIdentity } from './ci-token-identity';
import { ZeErrors, ZephyrError } from '../errors';

export async function saveToken(token: string): Promise<void> {
  await setPrivateItem(StorageKeys.ze_auth_token, token);
}

export async function getToken(git_config?: ZeGitInfo): Promise<string | undefined> {
  const tokenFromEnv = getSecretToken();
  const server_token = getServerToken();
  const ci_token = getCiToken();

  if (tokenFromEnv) {
    return tokenFromEnv;
  }

  if (ci_token) {
    const ciIdentity = await inferCiTokenIdentity();
    if (ciIdentity) {
      ze_log.auth(
        `Using ${ciIdentity.provider} ${ciIdentity.source} identity for CI token attribution`
      );
      return await getTokenFromCiToken(ci_token, ciIdentity);
    }

    throwCiTokenAuthError(
      undefined,
      `${StorageKeys.ze_ci_token} was provided, but no supported CI identity was detected.`
    );
  }

  // An explicitly configured server principal must win over browser state whenever the
  // git identity required for exchange is available (notably during checkAuth). Later
  // config lookups omit git_config and intentionally reuse the exchanged access token.
  if (server_token && git_config) {
    return await getTokenFromServerToken(server_token, git_config.git.email);
  }

  await storage;
  const token = await nodePersist.getItem(StorageKeys.ze_auth_token);
  if (token) {
    return token;
  }

  if (server_token) {
    ze_log.error('No git config provided, skipping server token check');
    return undefined;
  }

  return undefined;
}

export async function removeToken(): Promise<void> {
  await storage;
  await nodePersist.removeItem(StorageKeys.ze_auth_token);
}

export async function cleanTokens(): Promise<void> {
  await storage;
  await nodePersist.clear();
}

async function getTokenFromServerToken(
  server_token: string,
  git_email: string
): Promise<string | undefined> {
  const email = getUserEmail() ?? git_email;
  const [ok, cause, data] = await makeRequest<{ access_token: string }>(
    {
      path: ze_api_gateway.get_access_token_by_server_token,
      base: ZE_API_ENDPOINT(),
      query: { email },
    },
    {
      headers: {
        Authorization: `Bearer ${server_token}`,
      },
    }
  );

  if (!ok) {
    if (cause instanceof Error) {
      ze_log.error('Failed to get token from server token:', cause.message);
    } else {
      ze_log.error('Failed to get token from server token:', cause);
    }
    return undefined;
  }
  await saveToken(data?.access_token ?? '');
  return data?.access_token;
}

async function getTokenFromCiToken(
  ci_token: string,
  identity: CiTokenIdentity
): Promise<string | undefined> {
  const [ok, cause, data] = await makeRequest<{ access_token: string }>(
    {
      path: ze_api_gateway.ci_token_exchange,
      base: ZE_API_ENDPOINT(),
      query: {},
    },
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ci_token}`,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify(identity)
  );

  if (!ok) {
    throwCiTokenAuthError(identity, cause);
  }

  await saveToken(data?.access_token ?? '');
  return data?.access_token;
}

function throwCiTokenAuthError(
  identity: CiTokenIdentity | undefined,
  cause: unknown
): never {
  const details = cause instanceof Error ? cause.message : String(cause);
  ze_log.error('Failed to get token from CI token:', details);

  throw new ZephyrError(ZeErrors.ERR_CI_TOKEN_AUTH, {
    cause,
    provider: identity?.provider ?? 'unknown',
    username: identity?.username ?? 'unknown',
    source: identity?.source ?? 'unknown',
    issuer: identity?.issuer ?? 'unknown',
    details,
  });
}
