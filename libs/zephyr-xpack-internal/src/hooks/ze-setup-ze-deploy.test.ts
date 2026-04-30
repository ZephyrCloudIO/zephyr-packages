import { describe, expect, it, jest } from '@jest/globals';

const xpackZephyrAgentMock = jest.fn<() => Promise<void>>();

jest.mock('../xpack-extract/ze-xpack-upload-agent', () => ({
  xpack_zephyr_agent: xpackZephyrAgentMock,
}));

import { setupZeDeploy } from './ze-setup-ze-deploy';

describe('setupZeDeploy', () => {
  function createHarness(): {
    processAssetsCallback: (assets: Record<string, unknown>) => Promise<void>;
    zephyr_engine: {
      start_new_build: ReturnType<typeof jest.fn>;
    };
    stats: {
      toJson: ReturnType<typeof jest.fn>;
    };
  } {
    let processAssetsCallback:
      | ((assets: Record<string, unknown>) => Promise<void>)
      | undefined;

    const stats = {
      toJson: jest.fn(() => ({ stats: 'json' })),
    };

    const compilation = {
      getStats: jest.fn(() => stats),
      hooks: {
        processAssets: {
          tapPromise: jest.fn(
            (
              _options: { name: string; stage: number },
              cb: (assets: Record<string, unknown>) => Promise<void>
            ) => {
              processAssetsCallback = cb;
            }
          ),
        },
      },
    };

    const compiler = {
      webpack: {
        Compilation: {
          PROCESS_ASSETS_STAGE_REPORT: 123,
        },
      },
      hooks: {
        thisCompilation: {
          tap: jest.fn((_pluginName: string, cb: (value: typeof compilation) => void) => {
            cb(compilation);
          }),
        },
      },
    };

    const zephyr_engine = {
      start_new_build: jest.fn(async () => undefined),
    };

    setupZeDeploy(
      {
        pluginName: 'test-plugin',
        zephyr_engine: zephyr_engine as never,
      },
      compiler
    );

    if (!processAssetsCallback) {
      throw new Error('processAssets callback was not registered');
    }

    return { processAssetsCallback, zephyr_engine, stats };
  }

  it('waits for the upload agent before completing the processAssets hook', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { processAssetsCallback, zephyr_engine, stats } = createHarness();

    let resolveAgent!: () => void;
    xpackZephyrAgentMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveAgent = resolve;
        })
    );

    let settled = false;
    const hookPromise = processAssetsCallback({ asset: {} }).then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    resolveAgent();
    await hookPromise;

    expect(zephyr_engine.start_new_build).toHaveBeenCalledTimes(1);
    expect(stats.toJson).toHaveBeenCalledTimes(1);
    expect(xpackZephyrAgentMock).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it('propagates upload agent failures', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { processAssetsCallback } = createHarness();

    xpackZephyrAgentMock.mockRejectedValueOnce(new Error('deploy failed'));

    await expect(processAssetsCallback({})).rejects.toThrow('deploy failed');

    consoleSpy.mockRestore();
  });
});
