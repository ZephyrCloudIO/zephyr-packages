import { existsSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  authLog: rs.fn(),
  debugLog: rs.fn(),
  disposeSession: rs.fn(),
  getToken: rs.fn().mockResolvedValue(undefined),
  stdinTTY: true,
  stdoutTTY: true,
  stderrTTY: true,
  logFn: rs.fn(),
  makeRequest: rs
    .fn()
    .mockResolvedValue([
      true,
      null,
      'https://auth.example/authorize?state=server-one-time-state',
    ]),
  openUrl: rs.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
  question: rs.fn<(prompt: string) => never>(() => {
    throw new Error('browser prompt unavailable');
  }),
  saveToken: rs.fn(),
  waitForToken: rs.fn(),
}));

rs.mock('jose', () => ({ decodeJwt: rs.fn() }));
rs.mock('ci-info', () => ({ isCI: false }));
rs.mock('node:readline', () => ({
  createInterface: rs.fn(() => ({ question: mocks.question })),
}));
rs.mock('node:tty', () => ({
  isatty: rs.fn((fd: number) =>
    fd === 0 ? mocks.stdinTTY : fd === 1 ? mocks.stdoutTTY : mocks.stderrTTY
  ),
}));
rs.mock('./open-url', () => ({ openUrl: mocks.openUrl }));
rs.mock('zephyr-edge-contract', () => ({
  ZE_API_ENDPOINT: rs.fn(() => 'https://api.example/'),
  formatString: rs.fn((message: string) => message),
  stripAnsi: rs.fn((value: string) => value),
  ze_api_gateway: {
    authorize_link: '/authorize-link',
    websocket: '/auth-events',
  },
}));
rs.mock('../http/http-request', () => ({ makeRequest: mocks.makeRequest }));
rs.mock('../logging', () => ({
  ze_debug: mocks.debugLog,
  ze_log: { auth: mocks.authLog },
}));
rs.mock('../logging/ze-log-event', () => ({
  formatLogMsg: rs.fn((message: string) => message),
  logFn: mocks.logFn,
}));
rs.mock('../logging/picocolor', () => ({
  blue: (value: string) => value,
  bold: (value: string) => value,
  gray: (value: string) => value,
  green: (value: string) => value,
  isTTY: true,
  white: (value: string) => value,
  yellow: (value: string) => value,
}));
rs.mock('../node-persist/secret-token', () => ({ getSecretToken: rs.fn() }));
rs.mock('../node-persist/server-token', () => ({ getServerToken: rs.fn() }));
rs.mock('../node-persist/ci-token', () => ({ getCiToken: rs.fn() }));
rs.mock('../node-persist/session-lock', () => ({
  getSessionKey: rs.fn(() => ({
    owner: true,
    session: 'raw-local-session-id',
    [Symbol.dispose]: mocks.disposeSession,
  })),
  waitForUnlock: rs.fn(),
}));
rs.mock('../node-persist/token', () => ({
  getToken: mocks.getToken,
  removeToken: rs.fn(),
  saveToken: mocks.saveToken,
}));
rs.mock('./sse', () => ({
  AuthListener: class MockAuthListener {
    waitForToken(): Promise<unknown> {
      return mocks.waitForToken();
    }
  },
}));

import { checkAuth } from './login';

describe('interactive authentication cleanup', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.stdinTTY = true;
    mocks.stdoutTTY = true;
    mocks.stderrTTY = true;
  });

  it('fails with authentication guidance instead of waiting without an interactive stdin', async () => {
    mocks.stdinTTY = false;

    await expect(checkAuth()).rejects.toMatchObject({
      code: 'ZE10018',
      template: {
        message: expect.stringContaining('Interactive login is unavailable'),
      },
    });
    expect(mocks.makeRequest).not.toHaveBeenCalled();
    expect(mocks.waitForToken).not.toHaveBeenCalled();
  });

  // `> build.log` keeps stderr on the terminal; Nx on Windows pipes both stdout and
  // stderr (stdio ['inherit', 'pipe', 'pipe']) and may hold task output until the end.
  it.each([
    ['stdout is redirected', true],
    ['Nx pipes stdout and stderr', false],
  ])(
    'opens the browser without a prompt or printed URL when %s',
    async (_case, stderrTTY) => {
      mocks.stdoutTTY = false;
      mocks.stderrTTY = stderrTTY;
      // Login completes only after the browser was opened, as it would for a real user.
      const browserOpened = Promise.withResolvers<void>();
      mocks.openUrl.mockImplementationOnce(async () => browserOpened.resolve());
      mocks.waitForToken.mockImplementationOnce(async () => {
        await browserOpened.promise;
        return { token: 'raw-new-token' };
      });
      const stderrWrite = rs.spyOn(process.stderr, 'write').mockReturnValue(true);

      try {
        await expect(checkAuth()).resolves.toBeUndefined();

        const stderrOutput = stderrWrite.mock.calls
          .map((call) => String(call[0]))
          .join('');
        const userOutput = stderrOutput + JSON.stringify(mocks.logFn.mock.calls);
        expect(mocks.question).not.toHaveBeenCalled();
        expect(mocks.openUrl).toHaveBeenCalledWith(
          'https://auth.example/authorize?state=server-one-time-state'
        );
        expect(mocks.saveToken).toHaveBeenCalledWith('raw-new-token');
        expect(stderrOutput.includes('Opening your browser')).toBe(stderrTTY);
        expect(userOutput).not.toContain('server-one-time-state');
      } finally {
        stderrWrite.mockRestore();
      }
    }
  );

  it('removes the private fallback artifact when authentication fails or times out', async () => {
    mocks.waitForToken.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('authentication timeout')), 20);
        })
    );

    await expect(checkAuth({} as never)).rejects.toThrow('authentication timeout');

    const loggedMessages = mocks.logFn.mock.calls.map((call) => String(call[1]));
    const artifactPath = loggedMessages.find(
      (message) => basename(message) === 'login.html'
    );
    const prompt = String(mocks.question.mock.calls[0]?.[0]);
    const persistedOutput = JSON.stringify([
      mocks.authLog.mock.calls,
      mocks.debugLog.mock.calls,
      mocks.logFn.mock.calls,
    ]);

    expect(artifactPath).toBeDefined();
    expect(existsSync(artifactPath as string)).toBe(false);
    expect(existsSync(dirname(artifactPath as string))).toBe(false);
    expect(prompt).toContain(
      'https://auth.example/authorize?state=server-one-time-state'
    );
    expect(persistedOutput).not.toContain('server-one-time-state');
    expect(persistedOutput).not.toContain('raw-local-session-id');
    expect(mocks.disposeSession).toHaveBeenCalledTimes(1);
  });

  it('removes the private fallback artifact after successful authentication', async () => {
    mocks.waitForToken.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ token: 'raw-new-token', sessionId: 'raw-session-id' }),
            20
          );
        })
    );

    await expect(checkAuth({} as never)).resolves.toBeUndefined();

    const loggedMessages = mocks.logFn.mock.calls.map((call) => String(call[1]));
    const artifactPath = loggedMessages.find(
      (message) => basename(message) === 'login.html'
    );
    const persistedOutput = JSON.stringify([
      mocks.authLog.mock.calls,
      mocks.debugLog.mock.calls,
      mocks.logFn.mock.calls,
    ]);

    expect(artifactPath).toBeDefined();
    expect(existsSync(artifactPath as string)).toBe(false);
    expect(existsSync(dirname(artifactPath as string))).toBe(false);
    expect(mocks.saveToken).toHaveBeenCalledWith('raw-new-token');
    expect(persistedOutput).not.toContain('raw-new-token');
    expect(persistedOutput).not.toContain('raw-session-id');
    expect(mocks.disposeSession).toHaveBeenCalledTimes(1);
  });
});
