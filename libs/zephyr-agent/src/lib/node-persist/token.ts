import { createHash } from 'node:crypto';
import * as jose from 'jose';
import nodePersist from 'node-persist';
import { getSecretToken } from './secret-token';
import { setPrivateItem, storage } from './storage';
import { StorageKeys } from './storage-keys';
import { withStorageLock } from './storage-lock';
import { makeRequest } from '../http/http-request';
import { getCiToken } from './ci-token';
import { getServerToken } from './server-token';
import { ZE_API_ENDPOINT, ze_api_gateway } from 'zephyr-edge-contract';
import { getUserEmail } from './user-email';
import { ze_log } from '../logging/debug';
import { type ZeGitInfo } from '../build-context/ze-util-get-git-info';
import { type CiTokenIdentity, inferCiTokenIdentity } from './ci-token-identity';
import { ZeErrors, ZephyrError } from '../errors';
import { TOKEN_EXPIRY } from '../auth/auth-flags';

const CI_TOKEN_CACHE_VERSION = 1;
const CI_TOKEN_SCOPE_CONTEXT = 'zephyr-ci-token-cache\0';
const activeCiTokenCacheKeys = new Set<string>();

interface StoredCiAccessToken {
  version: typeof CI_TOKEN_CACHE_VERSION;
  scope: string;
  accessToken: string;
}

export async function saveToken(token: string): Promise<void> {
  await withStorageLock('auth-token', () =>
    setPrivateItem(StorageKeys.ze_auth_token, token)
  );
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

  const token = await withStorageLock('auth-token', async () => {
    await storage;
    return nodePersist.getItem(StorageKeys.ze_auth_token);
  });
  if (token) {
    return token;
  }

  if (server_token) {
    ze_log.error('No git config provided, skipping server token check');
    return undefined;
  }

  return undefined;
}

export async function removeToken(expectedToken?: string): Promise<void> {
  await withStorageLock('auth-token', async () => {
    await storage;
    const storedToken: unknown = await nodePersist.getItem(StorageKeys.ze_auth_token);
    if (expectedToken === undefined || storedToken === expectedToken) {
      await nodePersist.removeItem(StorageKeys.ze_auth_token);
    }
  });
}

export async function cleanTokens(rejectedToken?: string): Promise<void> {
  await removeToken(rejectedToken);
  const cacheKeys = Array.from(activeCiTokenCacheKeys);
  await Promise.all(
    cacheKeys.map((cacheKey) =>
      withStorageLock(getCiTokenLockName(cacheKey), async () => {
        await storage;
        const cached: unknown = await nodePersist.getItem(cacheKey);
        if (
          rejectedToken === undefined ||
          (isStoredCiAccessToken(cached) && cached.accessToken === rejectedToken)
        ) {
          await nodePersist.removeItem(cacheKey);
        }
      })
    )
  );
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
  const scope = getCiTokenScope(ci_token, identity);
  const cacheKey = `${StorageKeys.ze_ci_auth_token}:${scope}`;
  activeCiTokenCacheKeys.add(cacheKey);

  return withStorageLock(getCiTokenLockName(cacheKey), async () => {
    await storage;
    const cached: unknown = await nodePersist.getItem(cacheKey);
    if (isReusableCiAccessToken(cached, scope)) {
      return cached.accessToken;
    }

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
        skipTokenCleanup: true,
      },
      JSON.stringify(identity)
    );

    if (!ok) {
      await nodePersist.removeItem(cacheKey);
      throwCiTokenAuthError(identity, cause);
    }

    const accessToken = data?.access_token;
    const expiresIn = accessToken ? getTokenExpirationMs(accessToken) - Date.now() : 0;
    if (!accessToken || expiresIn <= TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC * 1000) {
      await nodePersist.removeItem(cacheKey);
      throwCiTokenAuthError(
        identity,
        new Error('CI token exchange returned an invalid or expiring access token')
      );
    }

    await setPrivateItem(
      cacheKey,
      { version: CI_TOKEN_CACHE_VERSION, scope, accessToken },
      { ttl: expiresIn }
    );
    return accessToken;
  });
}

function getCiTokenScope(ciToken: string, identity: CiTokenIdentity): string {
  const identityScope = [
    ZE_API_ENDPOINT(),
    identity.provider,
    identity.source,
    identity.issuer ?? '',
    identity.providerSubject ?? '',
    identity.username ?? '',
    identity.email ?? '',
    [...(identity.emails ?? [])].sort(),
  ];
  return createHash('sha256')
    .update(CI_TOKEN_SCOPE_CONTEXT)
    .update(ciToken)
    .update('\0')
    .update(JSON.stringify(identityScope))
    .digest('hex');
}

function getCiTokenLockName(cacheKey: string): string {
  return `ci-auth-${cacheKey.substring(cacheKey.lastIndexOf(':') + 1)}`;
}

function getTokenExpirationMs(token: string): number {
  try {
    const expiration = jose.decodeJwt(token).exp;
    return typeof expiration === 'number' ? expiration * 1000 : 0;
  } catch {
    return 0;
  }
}

function isReusableCiAccessToken(
  value: unknown,
  scope: string
): value is StoredCiAccessToken {
  return Boolean(
    isStoredCiAccessToken(value) &&
    (value as Partial<StoredCiAccessToken>).scope === scope &&
    getTokenExpirationMs((value as StoredCiAccessToken).accessToken) >
      Date.now() + TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC * 1000
  );
}

function isStoredCiAccessToken(value: unknown): value is StoredCiAccessToken {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as Partial<StoredCiAccessToken>).version === CI_TOKEN_CACHE_VERSION &&
    typeof (value as Partial<StoredCiAccessToken>).scope === 'string' &&
    typeof (value as Partial<StoredCiAccessToken>).accessToken === 'string'
  );
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
