import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fetchWithRetries } from '../http/fetch-with-retries';
import {
  maybeShowOutdatedPluginWarning,
  resetOutdatedPluginWarningStateForTests,
} from './outdated-plugin-warning';
import { getZephyrAgentVersion } from './zephyr-agent-version';

jest.mock('../http/fetch-with-retries', () => ({
  fetchWithRetries: jest.fn(),
}));
jest.mock('./zephyr-agent-version', () => ({
  getZephyrAgentVersion: jest.fn(() => '1.0.0'),
}));

describe('outdated-plugin-warning', () => {
  const fetchWithRetriesMock = fetchWithRetries as jest.MockedFunction<
    typeof fetchWithRetries
  >;
  const getZephyrAgentVersionMock = getZephyrAgentVersion as jest.MockedFunction<
    typeof getZephyrAgentVersion
  >;

  beforeEach(() => {
    jest.restoreAllMocks();
    resetOutdatedPluginWarningStateForTests();
    fetchWithRetriesMock.mockReset();
    getZephyrAgentVersionMock.mockReset();
    getZephyrAgentVersionMock.mockReturnValue('1.0.0');
  });

  it('shows warning when current version is older than latest', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchWithRetriesMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ latest: '1.2.0' }),
    } as Response);

    await maybeShowOutdatedPluginWarning('__unknown-plugin__');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain('Your Zephyr Plugin version is outdated');
    expect(errorSpy.mock.calls[0]?.[0]).toContain(
      'upgrade __unknown-plugin__ first.'
    );
    errorSpy.mockRestore();
  });

  it('does not show warning when versions are up to date', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchWithRetriesMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ latest: '1.0.0' }),
    } as Response);

    await maybeShowOutdatedPluginWarning('__unknown-plugin__');

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('shows warning once for the same package and version pair', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
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
