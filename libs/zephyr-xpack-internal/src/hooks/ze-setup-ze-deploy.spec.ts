import { rs } from '@rstest/core';
import { setupZeDeploy } from './ze-setup-ze-deploy';
import { xpack_zephyr_agent } from '../xpack-extract/ze-xpack-upload-agent';

rs.mock('../xpack-extract/ze-xpack-upload-agent', () => ({
  xpack_zephyr_agent: rs.fn(),
}));

describe('setupZeDeploy', () => {
  let consoleLogSpy: rs.SpyInstance;
  const compilation = {
    getStats: rs.fn().mockReturnValue({
      toJson: rs.fn().mockReturnValue({ hash: 'stats-json' }),
    }),
    hooks: {
      processAssets: {
        tapPromise: rs.fn(),
      },
    },
  };

  const compiler = {
    webpack: {
      Compilation: {
        PROCESS_ASSETS_STAGE_REPORT: 1000,
      },
    },
    hooks: {
      thisCompilation: {
        tap: rs.fn((_: string, cb: (compilation: typeof compilation) => void) => {
          cb(compilation);
        }),
      },
    },
  };

  beforeEach(() => {
    rs.clearAllMocks();
    consoleLogSpy = rs.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('awaits the upload agent before resolving the assets hook', async () => {
    let resolveUpload!: () => void;
    const uploadPromise = new Promise<void>((resolve) => {
      resolveUpload = resolve;
    });
    (xpack_zephyr_agent as rs.Mock).mockReturnValue(uploadPromise);

    setupZeDeploy(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {
          start_new_build: rs.fn().mockResolvedValue(undefined),
        } as never,
        mfConfig: undefined,
      },
      compiler as never
    );

    const processAssetsCallback = (compilation.hooks.processAssets.tapPromise as rs.Mock)
      .mock.calls[0][1];

    let settled = false;
    const hookPromise = processAssetsCallback({}).then(() => {
      settled = true;
    });

    await Promise.resolve();

    expect(xpack_zephyr_agent).toHaveBeenCalled();
    expect(settled).toBe(false);

    resolveUpload();
    await hookPromise;

    expect(settled).toBe(true);
  });

  it('does not await the upload agent when waiting for index.html', async () => {
    const uploadPromise = new Promise<void>(() => undefined);
    (xpack_zephyr_agent as rs.Mock).mockReturnValue(uploadPromise);

    setupZeDeploy(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {
          start_new_build: rs.fn().mockResolvedValue(undefined),
        } as never,
        mfConfig: undefined,
        wait_for_index_html: true,
      },
      compiler as never
    );

    const processAssetsCallback = (compilation.hooks.processAssets.tapPromise as rs.Mock)
      .mock.calls[0][1];

    await processAssetsCallback({});
    await new Promise(process.nextTick);

    expect(xpack_zephyr_agent).toHaveBeenCalled();
  });

  it('propagates upload agent failures', async () => {
    const error = new Error('deploy failed');
    (xpack_zephyr_agent as rs.Mock).mockRejectedValue(error);

    setupZeDeploy(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {
          start_new_build: rs.fn().mockResolvedValue(undefined),
        } as never,
        mfConfig: undefined,
      },
      compiler as never
    );

    const processAssetsCallback = (compilation.hooks.processAssets.tapPromise as rs.Mock)
      .mock.calls[0][1];

    await expect(processAssetsCallback({})).rejects.toThrow('deploy failed');
  });
});
