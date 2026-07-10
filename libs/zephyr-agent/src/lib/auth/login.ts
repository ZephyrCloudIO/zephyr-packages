import * as jose from 'jose';
import type openBrowser from 'open';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as readline from 'node:readline';
import { ZE_API_ENDPOINT, ze_api_gateway } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_debug, ze_log } from '../logging';
import { blue, bold, gray, green, isTTY, white, yellow } from '../logging/picocolor';
import { formatLogMsg, logFn } from '../logging/ze-log-event';
import { getSecretToken } from '../node-persist/secret-token';
import { getSessionKey, waitForUnlock } from '../node-persist/session-lock';
import { StorageKeys } from '../node-persist/storage-keys';
import { getToken, removeToken, saveToken } from '../node-persist/token';
import { AuthListener } from './sse';
import { TOKEN_EXPIRY } from './auth-flags';
import { getCiToken } from '../node-persist/ci-token';
import { getServerToken } from '../node-persist/server-token';
import { type ZeGitInfo } from '../build-context/ze-util-get-git-info';
import { redactUrl } from '../security/redaction';

interface PrivateAuthenticationArtifact {
  filePath: string;
  cleanup(): void;
}

/**
 * Check if the user is already authenticated. If not, ask if they want to open a browser
 * to authenticate. Display a message to the console.
 *
 * @returns The token as a string.
 */
export async function checkAuth(git_config: ZeGitInfo): Promise<void> {
  const secret_token = getSecretToken();
  const server_token = getServerToken();
  const ci_token = getCiToken();

  if (secret_token) {
    logFn('debug', 'Token found in environment. Using secret token for authentication.');
    return;
  }

  if (server_token) {
    logFn(
      'debug',
      'Server token found in environment. Using server token for authentication.'
    );
  }

  if (ci_token) {
    logFn('debug', 'CI token found in environment. Using CI-inferred token attribution.');
  }

  const existingToken = await getToken(git_config);

  if (existingToken) {
    // Check if the token has a valid expiration date.
    if (isTokenStillValid(existingToken, TOKEN_EXPIRY.SHORT_VALIDITY_CHECK_SEC)) {
      ze_log.auth('You are already logged in');
      return;
    }

    await removeToken();
  }

  // In non-TTY environments it's expected that a ZE_SECRET_TOKEN is present
  // since user cannot interact with it.
  if (!isTTY) {
    logFn('warn', `Could not load ${StorageKeys.ze_secret_token}.`);
  }

  // No valid token found; initiate authentication.
  logFn('', `${yellow('Authentication required')} - You need to log in to Zephyr Cloud`);

  // Get authentication URL first
  using sessionKey = getSessionKey();
  const authUrl = await getAuthenticationURL(sessionKey.session);

  if (!sessionKey.owner) {
    logFn('', gray('Waiting for session unlock...'));
  }

  const browserController = new AbortController();
  let privateAuthenticationArtifact: PrivateAuthenticationArtifact | undefined;

  // Tries to open the browser to authenticate the user
  void promptForAuthAction(authUrl, browserController.signal)
    .then(() => openUrl(authUrl))
    .catch(() => {
      // Aborting the prompt after a successful login is expected and must not print a
      // fallback link or create a credential-bearing artifact.
      if (!browserController.signal.aborted) {
        privateAuthenticationArtifact = fallbackManualLogin(authUrl);
      }
    })
    .finally(() => {
      if (browserController.signal.aborted) {
        privateAuthenticationArtifact?.cleanup();
      }
    });

  try {
    // We are the owner of the session request, join websocket room
    // and wait for the access token
    if (sessionKey.owner) {
      const newToken = await waitForAccessToken(sessionKey.session);
      await saveToken(newToken);
    } else {
      // node-persist is not concurrent safe, so we need to wait for the unlock
      // before next readToken() calls can happen
      // https://github.com/simonlast/node-persist/issues/108#issuecomment-1442305246
      await waitForUnlock(browserController.signal);

      const token = await getToken(git_config);

      // Unlock also happens on timeout, so we need to check if the token was
      // actually saved or not
      if (!token) {
        throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
          message: 'No token found after authentication finished, did it timeout?',
        });
      }
    }
  } finally {
    browserController.abort();
    privateAuthenticationArtifact?.cleanup();
  }

  logFn('', `${green('✓')} You are now logged in to Zephyr Cloud\n`);
}

/**
 * Decides whether the token is still valid based on its expiration time.
 *
 * @param token The token to check.
 * @param gap In seconds
 * @returns Boolean indicating if the token is still valid.
 */
export function isTokenStillValid(token: string, gap = 0): boolean {
  // Attempts to decode the token
  try {
    const decodedToken = jose.decodeJwt(token);

    if (decodedToken.exp) {
      return new Date(decodedToken.exp * 1000) > new Date(Date.now() + gap * 1000);
    }

    // No expiration date found, invalid token.
    return false;
  } catch {
    // If the token is invalid, return false.
    return false;
  }
}

/** Prompts the user to choose an authentication action */
async function promptForAuthAction(
  authUrl: string,
  signal: AbortSignal
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    signal,
  });

  return new Promise<string>((resolve) => {
    rl.question(
      formatAuthenticationPromptForTerminal(authUrl),

      { signal },
      resolve
    );
  });
}

/**
 * Format the one-time authorization URL for the interactive terminal only.
 *
 * This value must never be passed to `logFn`, a debug logger, an error, or the file
 * logger. Keeping this as a dedicated terminal prompt preserves the copy/paste login flow
 * while making persistent logging paths redact the state parameter.
 */
export function formatAuthenticationPromptForTerminal(
  authUrl: string,
  interactive = isTTY
): string {
  if (!interactive) {
    return formatLogMsg(
      '\nA private authentication link was generated. Waiting for browser authentication.\n'
    );
  }

  return [
    formatLogMsg('\nAuthentication URL (shown only in this terminal):'),
    authUrl,
    formatLogMsg(
      `\n${gray(`Hit ${bold(white('Enter'))} to open it in your browser.`)}\n`
    ),
  ].join('\n');
}

/** Helper to expose a credential-bearing login link without writing it to a log. */
function fallbackManualLogin(url: string): PrivateAuthenticationArtifact | undefined {
  logFn('', '');
  logFn('', `An unexpected error happened when opening the browser.`);

  let artifact: PrivateAuthenticationArtifact;
  try {
    artifact = createPrivateAuthenticationArtifact(url);
  } catch {
    logFn(
      'error',
      'Could not create a private authentication link. Please retry in an environment that can open a browser.'
    );
    return undefined;
  }

  try {
    logFn('', `${yellow('Please open this private HTML file in your browser:')}`);
    logFn('', artifact.filePath);
    logFn('', `${blue('⏳')} Waiting for you to complete authentication in browser...`);
    return artifact;
  } catch {
    // A logger failure must not strand a credential-bearing fallback artifact.
    artifact.cleanup();
    return undefined;
  }
}

export function createPrivateAuthenticationArtifact(
  url: string,
  writeArtifact: typeof writeFileSync = writeFileSync
): PrivateAuthenticationArtifact {
  const directory = mkdtempSync(join(tmpdir(), 'zephyr-auth-'));
  const filePath = join(directory, 'login.html');

  try {
    chmodSync(directory, 0o700);
    const escapedUrl = url
      .replace(/&/gu, '&amp;')
      .replace(/</gu, '&lt;')
      .replace(/>/gu, '&gt;')
      .replace(/"/gu, '&quot;')
      .replace(/'/gu, '&#39;');

    writeArtifact(
      filePath,
      `<!doctype html><meta http-equiv="refresh" content="0;url=${escapedUrl}"><title>Zephyr authentication</title>`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 }
    );
  } catch (error) {
    // A failed/partial write can still leave the one-time URL on disk. Best-effort
    // removal must happen before the original filesystem error is propagated.
    try {
      rmSync(directory, { force: true, recursive: true });
    } catch {
      // Preserve the creation failure; the directory and file are already private.
    }
    throw error;
  }

  return {
    filePath,
    cleanup: () => rmSync(directory, { force: true, recursive: true }),
  };
}

/** Opens the given URL in the default browser. */
async function openUrl(url: string): Promise<void> {
  // Lazy loads `open` module
  // oxlint-disable-next-line no-eval -- Preserve native import() in CommonJS output for ESM-only `open`.
  const openModule = (await eval(`import('open')`)) as {
    default: typeof openBrowser;
  };
  await openModule.default(url);
}

/** Generates the URL to authenticate the user. */
async function getAuthenticationURL(state: string): Promise<string> {
  const authorizeUrl = new URL(ze_api_gateway.authorize_link, ZE_API_ENDPOINT());
  authorizeUrl.searchParams.set('state', state);
  ze_log.auth('getAuthenticationURL', redactUrl(authorizeUrl));
  const [ok, cause, data] = await makeRequest<string>({
    path: ze_api_gateway.authorize_link,
    base: ZE_API_ENDPOINT(),
    query: { state },
  });

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_AUTH_ERROR, {
      cause,
      message: 'Could not get authentication URL',
    });
  }

  return data;
}

async function waitForAccessToken(sessionKey: string): Promise<string> {
  const url = new URL(ze_api_gateway.websocket, ZE_API_ENDPOINT());
  url.searchParams.set('sessionId', sessionKey);
  const authListener = new AuthListener(url);
  const resp = await authListener.waitForToken();
  ze_debug('waitForAccessToken', 'Received token for authentication session');
  return resp.token;
}
