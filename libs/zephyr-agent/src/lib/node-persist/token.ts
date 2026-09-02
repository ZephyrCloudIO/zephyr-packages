import { createHash } from 'node:crypto';
import nodePersist from 'node-persist';
import { getSecretToken } from './secret-token';
import { setPrivateItem, storage } from './storage';
import { StorageKeys } from './storage-keys';
import { withStorageLock, type StorageLockOptions } from './storage-lock';
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
import { getTokenExpirationMs, isTokenStillValid } from '../auth/token-expiry';

const CI_TOKEN_CACHE_VERSION = 1;
const CI_TOKEN_SCOPE_CONTEXT = 'zephyr-ci-token-cache\0';
const activeCiTokenCacheKeys = new Set<string>();

/**
 * Token coordination is an optimization, not an invariant. Without the lock, processes
 * repeat an exchange or race a single-key write, which is exactly the behavior before the
 * lock existed. An unavailable lock must therefore never fail a build.
 */
const TOKEN_LOCK: StorageLockOptions = { whenUnavailable: 'proceed' };

interface StoredCiAccessToken {
  version: typeof CI_TOKEN_CACHE_VERSION;
  scope: string;
  accessToken: string;
}

export async function saveToken(token: string): Promise<void> {
  await withStorageLock(
    'auth-token',
    () => setPrivateItem(StorageKeys.ze_auth_token, token),
    TOKEN_LOCK
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

  const token = await withStorageLock(
    'auth-token',
    async () => {
      await storage;
      return nodePersist.getItem(StorageKeys.ze_auth_token);
    },
    TOKEN_LOCK
  );
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
  await withStorageLock(
    'auth-token',
    async () => {
      await storage;
      const storedToken: unknown = await nodePersist.getItem(StorageKeys.ze_auth_token);
      if (expectedToken === undefined || storedToken === expectedToken) {
        await nodePersist.removeItem(StorageKeys.ze_auth_token);
      }
    },
    TOKEN_LOCK
  );
}

export async function cleanTokens(rejectedToken?: string): Promise<void> {
  await removeToken(rejectedToken);
  const cacheKeys = Array.from(activeCiTokenCacheKeys);
  await Promise.all(
    cacheKeys.map((cacheKey) =>
      withStorageLock(
        getCiTokenLockName(cacheKey),
        async () => {
          await storage;
          const cached: unknown = await nodePersist.getItem(cacheKey);
          if (
            rejectedToken === undefined ||
            (isStoredCiAccessToken(cached) && cached.accessToken === rejectedToken)
          ) {
            await nodePersist.removeItem(cacheKey);
          }
        },
        TOKEN_LOCK
      )
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
      // ZE_SERVER_TOKEN is a direct credential and is never persisted, so a 401 here
      // must not invalidate the unrelated browser access token.
      credentialToken: server_token,
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

  return withStorageLock(
    getCiTokenLockName(cacheKey),
    async () => {
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
          credentialToken: ci_token,
          skipTokenCleanup: true,
        },
        JSON.stringify(identity)
      );

      if (!ok) {
        await nodePersist.removeItem(cacheKey);
        throwCiTokenAuthError(identity, cause);
      }

      const accessToken = data?.access_token;
      if (
        !accessToken ||
        !isTokenStillValid(accessToken, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)
      ) {
        await nodePersist.removeItem(cacheKey);
        throwCiTokenAuthError(
          identity,
          new Error('CI token exchange returned an invalid or expiring access token')
        );
      }

      // Validity was just asserted, so the expiration is readable and in the future.
      const expiresAtMs = getTokenExpirationMs(accessToken) ?? Date.now();
      await setPrivateItem(
        cacheKey,
        { version: CI_TOKEN_CACHE_VERSION, scope, accessToken },
        { ttl: expiresAtMs - Date.now() }
      );
      return accessToken;
    },
    TOKEN_LOCK
  );
}

function getCiTokenScope(ciToken: string, identity: CiTokenIdentity): string {
  const identityScope = [
    ZE_API_ENDPOINT(),
    identity.provider,
    identity.source,
    identity.issuer ?? '',
    identity.providerSubject ?? '',
    identity.username ?? '',
    identity.providerActorType ?? '',
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

function isReusableCiAccessToken(
  value: unknown,
  scope: string
): value is StoredCiAccessToken {
  return (
    isStoredCiAccessToken(value) &&
    value.scope === scope &&
    isTokenStillValid(value.accessToken, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)
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
    actorType: identity?.providerActorType ?? 'unknown',
    resolution:
      identity?.providerActorType === 'bot'
        ? 'This bot is authorized by the CI token creator. Check that the token creator is still an active member of the Zephyr organization.'
        : "Link this CI actor's Git provider account in Zephyr Cloud, then rerun the workflow. Zephyr uses linked Git provider identities to map provider-native CI actor data, such as GitHub actor IDs or GitLab user IDs/emails, to a Zephyr user.",
    details,
  });
}
