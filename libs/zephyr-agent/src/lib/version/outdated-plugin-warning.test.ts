import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  maybeShowOutdatedPluginWarning,
  resetOutdatedPluginWarningStateForTests,
} from './outdated-plugin-warning';
import { getZephyrAgentVersion } from './zephyr-agent-version';

jest.mock('./zephyr-agent-version', () => ({
  getZephyrAgentVersion: jest.fn(() => '1.0.0'),
}));

describe('outdated-plugin-warning', () => {
  const getZephyrAgentVersionMock = getZephyrAgentVersion as jest.MockedFunction<
    typeof getZephyrAgentVersion
  >;

  beforeEach(() => {
    resetOutdatedPluginWarningStateForTests();
    getZephyrAgentVersionMock.mockReset();
    getZephyrAgentVersionMock.mockReturnValue('1.0.0');
  });

  it('shows warning when current version is older than latest', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (global as { fetch?: typeof fetch }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ latest: '1.2.0' }),
    } as Response);

    await maybeShowOutdatedPluginWarning('vite-plugin-zephyr');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain('Your Zephyr Plugin version is outdated');
    expect(errorSpy.mock.calls[0]?.[0]).toContain(
      'upgrade vite-plugin-zephyr first.'
    );
    errorSpy.mockRestore();
  });

  it('does not show warning when versions are up to date', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (global as { fetch?: typeof fetch }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ latest: '1.0.0' }),
    } as Response);

    await maybeShowOutdatedPluginWarning('vite-plugin-zephyr');

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('shows warning once for the same package and version pair', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (global as { fetch?: typeof fetch }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ latest: '1.2.0' }),
    } as Response);

    await maybeShowOutdatedPluginWarning('vite-plugin-zephyr');
    await maybeShowOutdatedPluginWarning('vite-plugin-zephyr');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
