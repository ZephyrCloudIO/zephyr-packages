import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { MockInstance, Mock } from '@rstest/core';

import { setupZeDeploy } from './ze-setup-ze-deploy';
import { xpack_zephyr_agent } from '../xpack-extract/ze-xpack-upload-agent';

rs.mock('../xpack-extract/ze-xpack-upload-agent', () => ({
  xpack_zephyr_agent: rs.fn(),
}));

describe('setupZeDeploy', () => {
  let consoleLogSpy: MockInstance;
  const compilation = {
    fileDependencies: new Set(['/repo/src/client.ts']),
    contextDependencies: new Set(['/repo/src']),
    missingDependencies: new Set(['/repo/src/generated.ts']),
    buildDependencies: new Set(['/repo/rspack.config.ts']),
    getStats: rs.fn().mockReturnValue({
      toJson: rs.fn().mockReturnValue({ hash: 'stats-json' }),
    }),
    hooks: {
      processAssets: {
        tapPromise: rs.fn(),
      },
    },
  };
  type TestCompilation = typeof compilation;

  const compiler = {
    webpack: {
      Compilation: {
        PROCESS_ASSETS_STAGE_REPORT: 1000,
      },
    },
    hooks: {
      thisCompilation: {
        tap: rs.fn((_: string, cb: (value: TestCompilation) => void) => {
          cb(compilation);
        }),
      },
      afterEmit: {
        tapPromise: rs.fn(),
      },
      invalid: {
        tap: rs.fn(),
      },
      failed: {
        tap: rs.fn(),
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
    (xpack_zephyr_agent as Mock).mockReturnValue(uploadPromise);

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

    const processAssetsCallback = (compilation.hooks.processAssets.tapPromise as Mock)
      .mock.calls[0][1];

    let settled = false;
    const hookPromise = processAssetsCallback({}).then(() => {
      settled = true;
    });

    await Promise.resolve();

    expect(xpack_zephyr_agent).toHaveBeenCalled();
    expect(xpack_zephyr_agent).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginOptions: expect.objectContaining({
          generation: 0,
          dependencyPaths: {
            fileDependencies: ['/repo/src/client.ts'],
            contextDependencies: ['/repo/src'],
            missingDependencies: ['/repo/src/generated.ts'],
            buildDependencies: ['/repo/rspack.config.ts'],
          },
        }),
      })
    );
    expect(settled).toBe(false);

    resolveUpload();
    await hookPromise;

    expect(settled).toBe(true);
  });

  it('awaits finalized index assets from afterEmit', async () => {
    let resolveUpload!: () => void;
    const uploadPromise = new Promise<void>((resolve) => {
      resolveUpload = resolve;
    });
    (xpack_zephyr_agent as Mock).mockReturnValue(uploadPromise);

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

    const processAssetsCallback = (compilation.hooks.processAssets.tapPromise as Mock)
      .mock.calls[0][1];

    await processAssetsCallback({});
    expect(xpack_zephyr_agent).not.toHaveBeenCalled();

    const afterEmitCallback = (compiler.hooks.afterEmit.tapPromise as Mock).mock
      .calls[0][1];
    let settled = false;
    const afterEmitPromise = afterEmitCallback(compilation).then(() => {
      settled = true;
    });

    await Promise.resolve();

    expect(xpack_zephyr_agent).toHaveBeenCalled();
    expect(xpack_zephyr_agent).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginOptions: expect.objectContaining({
          wait_for_index_html: false,
        }),
      })
    );
    expect(settled).toBe(false);

    resolveUpload();
    await afterEmitPromise;
    expect(settled).toBe(true);
  });

  it('propagates upload agent failures', async () => {
    const error = new Error('deploy failed');
    (xpack_zephyr_agent as Mock).mockRejectedValue(error);

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

    const processAssetsCallback = (compilation.hooks.processAssets.tapPromise as Mock)
      .mock.calls[0][1];

    await expect(processAssetsCallback({})).rejects.toThrow('deploy failed');
  });

  it('rolls back when starting a direct generation fails', async () => {
    const startFailure = new Error('build ID failed');
    const buildFailed = rs.fn();
    setupZeDeploy(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {
          hasActiveBuild: true,
          start_new_build: rs.fn().mockRejectedValue(startFailure),
          build_failed: buildFailed,
        } as never,
        mfConfig: undefined,
      },
      compiler as never
    );
    const processAssetsCallback = (compilation.hooks.processAssets.tapPromise as Mock)
      .mock.calls[0][1];

    await expect(processAssetsCallback({})).rejects.toBe(startFailure);
    expect(buildFailed).toHaveBeenCalledTimes(1);
    expect(xpack_zephyr_agent).not.toHaveBeenCalled();
  });

  it('propagates finalized index upload failures through afterEmit', async () => {
    const error = new Error('finalized deploy failed');
    (xpack_zephyr_agent as Mock).mockRejectedValue(error);

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

    const processAssetsCallback = (compilation.hooks.processAssets.tapPromise as Mock)
      .mock.calls[0][1];
    await processAssetsCallback({});
    const afterEmitCallback = (compiler.hooks.afterEmit.tapPromise as Mock).mock
      .calls[0][1];

    await expect(afterEmitCallback(compilation)).rejects.toThrow(
      'finalized deploy failed'
    );
  });

  it('marks coordinated participants dirty before processAssets', () => {
    const beginParticipant = rs.fn();
    const invalidateParticipant = rs.fn();
    const failParticipant = rs.fn();

    setupZeDeploy(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {} as never,
        mfConfig: undefined,
        coordinator: {
          beginParticipant,
          invalidateParticipant,
          failParticipant,
        } as never,
        participant: 'client',
      },
      compiler as never
    );

    expect(beginParticipant).toHaveBeenCalledWith('client', 0);
    const invalidCallback = (compiler.hooks.invalid.tap as Mock).mock.calls[0][1];
    invalidCallback('/repo/src/shared.ts');
    expect(invalidateParticipant).toHaveBeenCalledWith('client', '/repo/src/shared.ts');
    expect(compiler.hooks.failed.tap).toHaveBeenCalled();
  });

  it('fails the coordinated participant when compilation fails before upload', () => {
    const failParticipant = rs.fn();

    setupZeDeploy(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {} as never,
        mfConfig: undefined,
        coordinator: {
          beginParticipant: rs.fn(),
          invalidateParticipant: rs.fn(),
          failParticipant,
        } as never,
        participant: 'server',
      },
      compiler as never
    );

    const failedCallback = (compiler.hooks.failed.tap as Mock).mock.calls[0][1];
    const error = new Error('server compile failed');
    failedCallback(error);

    expect(failParticipant).toHaveBeenCalledWith('server', error);
  });

  it('fails closed before upload when compilation stats contain errors', async () => {
    const failParticipant = rs.fn();
    compilation.getStats.mockReturnValueOnce({
      hasErrors: () => true,
      toJson: rs.fn().mockReturnValue({ errors: ['compile failed'] }),
    });

    setupZeDeploy(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {} as never,
        mfConfig: undefined,
        coordinator: {
          beginParticipant: rs.fn(),
          invalidateParticipant: rs.fn(),
          failParticipant,
        } as never,
        participant: 'client',
      },
      compiler as never
    );
    const processAssetsCallback = (compilation.hooks.processAssets.tapPromise as Mock)
      .mock.calls[0][1];

    await expect(processAssetsCallback({})).rejects.toThrow(
      'compilation contains errors'
    );
    expect(failParticipant).toHaveBeenCalledTimes(1);
    expect(xpack_zephyr_agent).not.toHaveBeenCalled();
  });

  it('fails a deferred index upload before afterEmit can be skipped on errors', async () => {
    const failParticipant = rs.fn();
    compilation.getStats.mockReturnValueOnce({
      hasErrors: () => true,
      toJson: rs.fn().mockReturnValue({ errors: ['compile failed'] }),
    });

    setupZeDeploy(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {} as never,
        mfConfig: undefined,
        wait_for_index_html: true,
        coordinator: {
          beginParticipant: rs.fn(),
          invalidateParticipant: rs.fn(),
          failParticipant,
        } as never,
        participant: 'server',
      },
      compiler as never
    );
    const processAssetsCallback = (compilation.hooks.processAssets.tapPromise as Mock)
      .mock.calls[0][1];

    await expect(processAssetsCallback({})).rejects.toThrow(
      'compilation contains errors'
    );
    expect(failParticipant).toHaveBeenCalledTimes(1);
    expect(xpack_zephyr_agent).not.toHaveBeenCalled();

    const afterEmitCallback = (compiler.hooks.afterEmit.tapPromise as Mock).mock
      .calls[0][1];
    await expect(afterEmitCallback(compilation)).resolves.toBeUndefined();
    expect(xpack_zephyr_agent).not.toHaveBeenCalled();
  });

  it('rolls back a direct engine when compilation fails before upload', () => {
    const buildFailed = rs.fn();

    setupZeDeploy(
      {
        pluginName: 'ZePlugin',
        zephyr_engine: {
          build_failed: buildFailed,
        } as never,
        mfConfig: undefined,
      },
      compiler as never
    );

    const failedCallback = (compiler.hooks.failed.tap as Mock).mock.calls[0][1];
    failedCallback(new Error('compile failed'));

    expect(buildFailed).toHaveBeenCalledTimes(1);
  });
});
