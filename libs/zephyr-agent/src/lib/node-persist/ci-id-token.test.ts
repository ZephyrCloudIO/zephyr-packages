import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

import { readFileSync, rmSync } from 'node:fs';
import { stripAnsi } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { getToken } from './token';

/**
 * These tests run the real GitLab adapter, request builder, HTTP layer, error class and
 * debug logger. Only the HTTP client, the storage and the log sinks are replaced, so a
 * leak anywhere on the path from the environment to the request shows up here.
 */
const mocks = rs.hoisted(() => {
  const consoleLoggers: { mock: { calls: unknown[][] } }[] = [];
  return {
    axiosInstance: rs.fn(),
    getItem: rs.fn(),
    removeItem: rs.fn(),
    setPrivateItem: rs.fn(),
    writeLogToFile: rs.fn(),
    consoleLoggers,
    // Every debug namespace is enabled, so console output is captured as well.
    debugFactory: (namespace: string) => {
      const logger = Object.assign(rs.fn(), { enabled: true, namespace });
      consoleLoggers.push(logger);
      return logger;
    },
  };
});

rs.mock('debug', () => ({ default: mocks.debugFactory }));
rs.mock('../logging/file-logger', () => ({
  isFileLoggingEnabled: () => true,
  writeLogToFile: mocks.writeLogToFile,
}));
rs.mock('axios', () => ({
  default: { create: () => mocks.axiosInstance },
}));
// The proxy agent is unused here and loads its own copy of `debug`.
rs.mock('https-proxy-agent', () => ({ HttpsProxyAgent: rs.fn() }));
rs.mock('./storage', () => ({
  storage: Promise.resolve(),
  getItem: mocks.getItem,
  removeItem: mocks.removeItem,
  setPrivateItem: mocks.setPrivateItem,
}));
rs.mock('./storage-lock', () => ({
  withStorageLock: (_name: string, action: () => unknown) => action(),
}));

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function jwt(payload: Record<string, unknown>, signature: string): string {
  return [
    encode({ alg: 'RS256', typ: 'JWT', kid: 'key-1' }),
    encode(payload),
    signature,
  ].join('.');
}

/** Three base64url parts, but not a shape that log redaction recognizes on its own. */
const OPAQUE_ID_TOKEN = 'b3BhcXVl.aWQtdG9rZW4.c2lnbmF0dXJl';
const OTHER_OPAQUE_ID_TOKEN = 'b3RoZXI.aWQtdG9rZW4.c2lnbmF0dXJlMg';
/** What GitLab issues: a signed JWT with the audience chosen in the pipeline. */
const SIGNED_ID_TOKEN = jwt(
  {
    iss: 'https://gitlab.example.com',
    aud: 'https://zephyr-cloud.io',
    sub: 'project_path:group/app:ref_type:branch:ref:main',
    user_id: '42',
    user_login: 'builder',
  },
  'c2lnbmVkLWJ5LWdpdGxhYg'
);
const JOB_TOKEN = jwt(
  { user_id: 42, user_login: 'builder', user_email: 'builder@example.com' },
  'am9iLXRva2VuLXNpZ25hdHVyZQ'
);

const gitLabEnv = {
  GITLAB_CI: 'true',
  CI_SERVER_URL: 'https://gitlab.example.com',
  GITLAB_USER_EMAIL: 'builder@example.com',
  GITLAB_USER_ID: '42',
  GITLAB_USER_LOGIN: 'builder',
};

const gitLabIdentity = {
  provider: 'gitlab',
  email: 'builder@example.com',
  emails: ['builder@example.com'],
  issuer: 'https://gitlab.example.com',
  providerSubject: '42',
  username: 'builder',
  source: 'env',
};

function respond(status: number, data: unknown) {
  return { status, headers: {}, data };
}

function accessToken(): string {
  return jwt({ exp: Math.floor(Date.now() / 1000) + 60 * 60 }, 'YWNjZXNz');
}

function sentBodies(): string[] {
  return mocks.axiosInstance.mock.calls.map(
    ([, config]) => (config as { data: string }).data
  );
}

function sentBody(): Record<string, unknown> {
  const bodies = sentBodies();
  expect(bodies).toHaveLength(1);
  return JSON.parse(bodies[0]) as Record<string, unknown>;
}

/** Every debug and file log line, as it is written after redaction. */
function writtenLogs(): string {
  const fileLogs = mocks.writeLogToFile.mock.calls.map(([entry]) =>
    JSON.stringify(entry)
  );
  const consoleLogs = mocks.consoleLoggers.flatMap((logger) =>
    logger.mock.calls.map((args) => JSON.stringify(args))
  );
  return [...fileLogs, ...consoleLogs].join('\n');
}

describe('CI ID token', () => {
  const originalEnv = process.env;
  const temporaryFiles: string[] = [];

  function setEnv(env: Record<string, string>): void {
    process.env = {
      PATH: originalEnv['PATH'],
      HOME: originalEnv['HOME'],
      TMPDIR: originalEnv['TMPDIR'],
      ZE_CI_TOKEN: 'ci-token',
      ...env,
    };
  }

  /** Collects every place a failed exchange is shown or written. */
  async function failedExchangeOutputs(): Promise<string[]> {
    const error = await getToken().then(
      () => undefined,
      (reason: unknown) => reason
    );
    expect(ZephyrError.is(error, ZeErrors.ERR_CI_TOKEN_AUTH)).toBe(true);

    const formatted = stripAnsi(ZephyrError.format(error));
    const file = formatted.match(/Complete error details available at (.+\.json)/u)?.[1];
    expect(file).toBeDefined();
    temporaryFiles.push(file as string);

    return [
      (error as Error).message,
      String((error as Error).stack),
      formatted,
      JSON.stringify(error),
      readFileSync(file as string, 'utf8'),
      writtenLogs(),
    ];
  }

  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getItem.mockResolvedValue(undefined);
    mocks.axiosInstance.mockImplementation(async () =>
      respond(200, { access_token: accessToken() })
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    for (const file of temporaryFiles.splice(0)) {
      rmSync(file, { force: true });
    }
  });

  it('sends a well-formed ZE_CI_ID_TOKEN as idToken next to the identity fields', async () => {
    setEnv({ ...gitLabEnv, ZE_CI_ID_TOKEN: SIGNED_ID_TOKEN });

    await getToken();

    expect(sentBody()).toEqual({ ...gitLabIdentity, idToken: SIGNED_ID_TOKEN });
  });

  it('trims surrounding whitespace before sending the token', async () => {
    setEnv({ ...gitLabEnv, ZE_CI_ID_TOKEN: `  ${OPAQUE_ID_TOKEN}\n` });

    await getToken();

    expect(sentBody()['idToken']).toBe(OPAQUE_ID_TOKEN);
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['blank', '   '],
  ])('sends no idToken when ZE_CI_ID_TOKEN is %s', async (_label, value) => {
    setEnv({ ...gitLabEnv, ...(value === undefined ? {} : { ZE_CI_ID_TOKEN: value }) });

    await getToken();

    expect(sentBody()).toEqual(gitLabIdentity);
  });

  it.each([
    ['plain text', 'not-a-jwt-secret-value'],
    ['two parts', 'bWFsZm9ybWVk.dHdvLXBhcnRz'],
    ['four parts', 'bWFsZm9ybWVk.Zm91cg.cGFydHM.dG9rZW4'],
    ['an empty part', 'bWFsZm9ybWVk..ZW1wdHktcGFydA'],
    ['characters outside base64url', 'bWFsZm9ybWVk.cGFkZGVk.dmFsdWU='],
    ['inner whitespace', 'bWFsZm9ybWVk.aW5uZXI. d2hpdGVzcGFjZQ'],
  ])(
    'ignores a ZE_CI_ID_TOKEN with %s and notes it without the value',
    async (_l, value) => {
      setEnv({ ...gitLabEnv, ZE_CI_ID_TOKEN: value });

      await getToken();

      expect(sentBody()).toEqual(gitLabIdentity);
      const logs = writtenLogs();
      expect(logs).toContain('ZE_CI_ID_TOKEN is not a well-formed JWT');
      expect(logs).not.toContain(value);
      for (const part of value.split(/[.\s]+/u).filter((piece) => piece.length > 4)) {
        expect(logs).not.toContain(part);
      }
    }
  );

  it('never sends CI_JOB_TOKEN to Zephyr, with or without an ID token', async () => {
    setEnv({ ...gitLabEnv, CI_JOB_TOKEN: JOB_TOKEN });
    await getToken();

    setEnv({ ...gitLabEnv, CI_JOB_TOKEN: JOB_TOKEN, ZE_CI_ID_TOKEN: OPAQUE_ID_TOKEN });
    await getToken();

    const [withoutIdToken, withIdToken] = sentBodies();
    expect(JSON.parse(withoutIdToken)).not.toHaveProperty('idToken');
    expect(JSON.parse(withIdToken)).toHaveProperty('idToken', OPAQUE_ID_TOKEN);
    for (const body of [withoutIdToken, withIdToken]) {
      expect(body).not.toContain(JOB_TOKEN);
    }
    for (const [url, options] of mocks.axiosInstance.mock.calls) {
      expect(String(url)).not.toContain(JOB_TOKEN);
      expect(JSON.stringify(options)).not.toContain(JOB_TOKEN);
    }
  });

  it('sends the ID token only for GitLab', async () => {
    setEnv({
      GITHUB_ACTIONS: 'true',
      GITHUB_ACTOR: 'octocat',
      GITHUB_ACTOR_ID: '12345',
      ZE_CI_ID_TOKEN: OPAQUE_ID_TOKEN,
    });

    await getToken();

    const body = sentBody();
    expect(body['provider']).toBe('github');
    expect(body).not.toHaveProperty('idToken');
    expect(JSON.stringify(body)).not.toContain(OPAQUE_ID_TOKEN);
  });

  it('uses the same cache scope with, without and with a different ID token', async () => {
    for (const idToken of [undefined, OPAQUE_ID_TOKEN, OTHER_OPAQUE_ID_TOKEN]) {
      setEnv({ ...gitLabEnv, ...(idToken ? { ZE_CI_ID_TOKEN: idToken } : {}) });
      await getToken();
    }

    expect(mocks.setPrivateItem).toHaveBeenCalledTimes(3);
    const [first, second, third] = mocks.setPrivateItem.mock.calls.map(
      ([key, record]) => ({
        key: key as string,
        scope: (record as { scope: string }).scope,
      })
    );
    expect(first.key).toMatch(/^ze-ci-auth-token:[a-f0-9]{64}$/);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it('reuses the cached access token when only the ID token changes', async () => {
    const persisted = new Map<string, unknown>();
    mocks.getItem.mockImplementation(async (key: string) => persisted.get(key));
    mocks.setPrivateItem.mockImplementation(async (key: string, value: unknown) => {
      persisted.set(key, value);
    });

    setEnv({ ...gitLabEnv, ZE_CI_ID_TOKEN: OPAQUE_ID_TOKEN });
    const first = await getToken();
    setEnv({ ...gitLabEnv, ZE_CI_ID_TOKEN: OTHER_OPAQUE_ID_TOKEN });
    const second = await getToken();

    expect(second).toBe(first);
    expect(mocks.axiosInstance).toHaveBeenCalledTimes(1);
    expect(persisted.size).toBe(1);
  });

  it('keeps the ID token out of storage and logs on a successful exchange', async () => {
    setEnv({ ...gitLabEnv, ZE_CI_ID_TOKEN: OPAQUE_ID_TOKEN });

    await getToken();

    const storageCalls = [mocks.getItem, mocks.removeItem, mocks.setPrivateItem].flatMap(
      (mock) => mock.mock.calls
    );
    expect(mocks.setPrivateItem).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(storageCalls)).not.toContain(OPAQUE_ID_TOKEN);
    const logs = writtenLogs();
    expect(logs).toContain('ZE_CI_ID_TOKEN is set');
    expect(logs).toContain('gitlab env identity');
    expect(logs).not.toContain(OPAQUE_ID_TOKEN);
  });

  it('keeps the ID token out of the error, its detail file and the logs when the exchange is rejected', async () => {
    setEnv({ ...gitLabEnv, ZE_CI_ID_TOKEN: OPAQUE_ID_TOKEN });
    mocks.axiosInstance.mockImplementation(async () =>
      respond(401, { message: 'CI actor is not a member of the token organization' })
    );

    const outputs = await failedExchangeOutputs();

    expect(sentBody()['idToken']).toBe(OPAQUE_ID_TOKEN);
    expect(outputs[0]).toContain('ZE_CI_TOKEN could not be exchanged');
    for (const output of outputs) {
      expect(output).not.toContain(OPAQUE_ID_TOKEN);
    }
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('keeps the ID token hidden when the HTTP client fails with the request attached', async () => {
    setEnv({ ...gitLabEnv, ZE_CI_ID_TOKEN: OPAQUE_ID_TOKEN });
    mocks.axiosInstance.mockImplementation(async (_url: string, config: object) => {
      // HTTP client errors carry the request they failed on, body included.
      throw Object.assign(new Error('socket hang up'), {
        code: 'ERR_BAD_RESPONSE',
        config,
      });
    });

    const outputs = await failedExchangeOutputs();

    expect(sentBody()['idToken']).toBe(OPAQUE_ID_TOKEN);
    for (const output of outputs) {
      expect(output).not.toContain(OPAQUE_ID_TOKEN);
    }
  });

  const serverEchoes: [label: string, echo: (body: string) => unknown][] = [
    [
      'the request body',
      (body) => ({ message: 'Bad Request', received: JSON.parse(body) as unknown }),
    ],
    ['the bare token in text', () => `Rejected ID token ${SIGNED_ID_TOKEN} for this job`],
    [
      'the bare token in JSON',
      () => ({ message: `Could not verify ${SIGNED_ID_TOKEN}` }),
    ],
  ];

  it.each(serverEchoes)(
    'keeps the ID token hidden when the server echoes %s',
    async (_label, echo) => {
      setEnv({ ...gitLabEnv, ZE_CI_ID_TOKEN: SIGNED_ID_TOKEN });
      mocks.axiosInstance.mockImplementation(
        async (_url: string, config: { data: string }) => respond(400, echo(config.data))
      );

      const outputs = await failedExchangeOutputs();

      expect(sentBody()['idToken']).toBe(SIGNED_ID_TOKEN);
      expect(outputs[0]).toContain('ZE_CI_TOKEN could not be exchanged');
      // The server text reached the error, with the token replaced.
      expect(outputs[0]).toContain('[REDACTED]');
      for (const output of outputs) {
        expect(output).not.toContain(SIGNED_ID_TOKEN);
        // The signature is what makes the token usable, so check it on its own as well.
        expect(output).not.toContain(SIGNED_ID_TOKEN.split('.')[2]);
      }
    }
  );
});
