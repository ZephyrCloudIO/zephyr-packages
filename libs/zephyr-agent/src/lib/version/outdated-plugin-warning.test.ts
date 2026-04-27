import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import {
  maybeShowOutdatedPluginWarning,
  resetOutdatedPluginWarningStateForTests,
} from './outdated-plugin-warning';

const { fetchWithRetriesMock, getZephyrAgentVersionMock } = rs.hoisted(() => ({
  fetchWithRetriesMock: rs.fn(),
  getZephyrAgentVersionMock: rs.fn(() => '1.0.0'),
}));

rs.mock('../http/fetch-with-retries', () => ({
  fetchWithRetries: fetchWithRetriesMock,
}));
rs.mock('./zephyr-agent-version', () => ({
  getZephyrAgentVersion: getZephyrAgentVersionMock,
}));

describe('outdated-plugin-warning', () => {
  beforeEach(() => {
    rs.restoreAllMocks();
    resetOutdatedPluginWarningStateForTests();
    fetchWithRetriesMock.mockReset();
    getZephyrAgentVersionMock.mockReset();
    getZephyrAgentVersionMock.mockReturnValue('1.0.0');
  });

  it('shows warning when stable version is older than latest', async () => {
    const errorSpy = rs
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    fetchWithRetriesMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ latest: '1.2.0', canary: '0.0.0-canary.44' }),
    } as Response);

    await maybeShowOutdatedPluginWarning('__unknown-plugin__');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain(
      'Your Zephyr Plugin version is outdated'
    );
    expect(errorSpy.mock.calls[0]?.[0]).toContain('latest: 1.2.0');
    expect(errorSpy.mock.calls[0]?.[0]).toContain(
      'upgrade __unknown-plugin__ first.'
    );
    errorSpy.mockRestore();
  });

  it('does not show warning when versions are up to date', async () => {
    const errorSpy = rs
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    fetchWithRetriesMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ latest: '1.0.0' }),
    } as Response);

    await maybeShowOutdatedPluginWarning('__unknown-plugin__');

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('shows warning when canary version is older than latest canary', async () => {
    const errorSpy = rs
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    getZephyrAgentVersionMock.mockReturnValue('0.0.0-canary.44');
    fetchWithRetriesMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        latest: '0.1.14',
        canary: '0.0.0-canary.46',
      }),
    } as Response);

    await maybeShowOutdatedPluginWarning('__unknown-plugin__');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain(
      'current: 0.0.0-canary.44, latest canary: 0.0.0-canary.46'
    );
    errorSpy.mockRestore();
  });

  it('shows warning when next version is older than latest next', async () => {
    const errorSpy = rs
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    getZephyrAgentVersionMock.mockReturnValue('0.1.14-next.1');
    fetchWithRetriesMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        latest: '0.1.14',
        next: '0.1.14-next.3',
      }),
    } as Response);

    await maybeShowOutdatedPluginWarning('__unknown-plugin__');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain(
      'current: 0.1.14-next.1, latest next: 0.1.14-next.3'
    );
    errorSpy.mockRestore();
  });

  it('does not show warning for canary when canary dist-tag is missing', async () => {
    const errorSpy = rs
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    getZephyrAgentVersionMock.mockReturnValue('0.0.0-canary.44');
    fetchWithRetriesMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ latest: '0.1.14' }),
    } as Response);

    await maybeShowOutdatedPluginWarning('__unknown-plugin__');

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('shows warning once for the same package and version pair', async () => {
    const errorSpy = rs
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    fetchWithRetriesMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ latest: '1.2.0' }),
    } as Response);

    await maybeShowOutdatedPluginWarning('__unknown-plugin__');
    await maybeShowOutdatedPluginWarning('__unknown-plugin__');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
