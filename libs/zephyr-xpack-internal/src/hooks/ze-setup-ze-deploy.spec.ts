import { setupZeDeploy } from './ze-setup-ze-deploy';
import { xpack_zephyr_agent } from '../xpack-extract/ze-xpack-upload-agent';

jest.mock('../xpack-extract/ze-xpack-upload-agent', () => ({
  xpack_zephyr_agent: jest.fn(),
}));

describe('setupZeDeploy', () => {
  let consoleLogSpy: jest.SpyInstance;
  const compilation = {
    getStats: jest.fn().mockReturnValue({
      toJson: jest.fn().mockReturnValue({ hash: 'stats-json' }),
    }),
    hooks: {
      processAssets: {
        tapPromise: jest.fn(),
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
        tap: jest.fn((_: string, cb: (compilation: typeof compilation) => void) => {
          cb(compilation);
        }),
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('awaits the upload agent before resolving the assets hook', async () => {
    let resolveUpload!: () => void;
    const uploadPromise = new Promise<void>((resolve) => {
      resolveUpload = resolve;
    });
    (xpack_zephyr_agent as jest.Mock).mockReturnValue(uploadPromise);

    setupZeDeploy(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {
          start_new_build: jest.fn().mockResolvedValue(undefined),
        } as never,
        mfConfig: undefined,
      },
      compiler as never
    );

    const processAssetsCallback = (
      compilation.hooks.processAssets.tapPromise as jest.Mock
    ).mock.calls[0][1];

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

  it('propagates upload agent failures', async () => {
    const error = new Error('deploy failed');
    (xpack_zephyr_agent as jest.Mock).mockRejectedValue(error);

    setupZeDeploy(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {
          start_new_build: jest.fn().mockResolvedValue(undefined),
        } as never,
        mfConfig: undefined,
      },
      compiler as never
    );

    const processAssetsCallback = (
      compilation.hooks.processAssets.tapPromise as jest.Mock
    ).mock.calls[0][1];

    await expect(processAssetsCallback({})).rejects.toThrow('deploy failed');
  });
});
