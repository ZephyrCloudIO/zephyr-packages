import { clear, getItem, removeItem, setItem } from 'node-persist';
import { getSecretToken } from './secret-token';
import { storage } from './storage';
import { StorageKeys } from './storage-keys';
import { makeRequest } from '../http/http-request';
import { getServerToken } from './server-token';
import { ZE_API_ENDPOINT, ze_api_gateway } from 'zephyr-edge-contract';
import { getUserEmail } from './user-email';
import { ze_log } from '../logging/debug';
import { ZeGitInfo } from '../build-context/ze-util-get-git-info';

export async function saveToken(token: string): Promise<void> {
  await storage;
  await setItem(StorageKeys.ze_auth_token, token);
}

export async function getToken(git_config?: ZeGitInfo): Promise<string | undefined> {
  const tokenFromEnv = getSecretToken();
  const server_token = getServerToken();

  if (tokenFromEnv) {
    return tokenFromEnv;
  }

  await storage;
  const token = await getItem(StorageKeys.ze_auth_token);
  if (token) {
    return token;
  }

  if (server_token) {
    if (!git_config) {
      ze_log.error('No git config provided, skipping server token check');
      return undefined;
    }
    return await getTokenFromServerToken(server_token, git_config.git.email);
  }

  return undefined;
}

export async function removeToken(): Promise<void> {
  await storage;
  await removeItem(StorageKeys.ze_auth_token);
}

export async function cleanTokens(): Promise<void> {
  await storage;
  await clear();
}

async function getTokenFromServerToken(
  server_token: string,
  git_email: string
): Promise<string | undefined> {
  const email = getUserEmail() ?? git_email;
  const [ok, cause, data] = await makeRequest<string>(
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
    return undefined;
  }

  if (cause) {
    ze_log.error('Failed to get token from server token:', cause);
    return undefined;
  }

  saveToken(data);

  return data;
}
