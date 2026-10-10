import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { uploadAssets } from './upload';

rs.mock('./build-stats', () => ({
  getBuildStats: rs.fn().mockResolvedValue({}),
}));

rs.mock('zephyr-agent', () => ({
  logFn: rs.fn(),
  ZephyrError: { format: (error: unknown) => String(error) },
}));

describe('CLI upload lifecycle', () => {
  const engine = {
    build_id: Promise.resolve('build-id'),
    start_new_build: rs.fn(),
    upload_assets: rs.fn(),
    build_finished: rs.fn(),
    build_failed: rs.fn(),
  };

  beforeEach(() => {
    rs.clearAllMocks();
    engine.start_new_build.mockResolvedValue(undefined);
    engine.upload_assets.mockResolvedValue(undefined);
    engine.build_finished.mockResolvedValue(undefined);
  });

  it('rolls back a failed upload and permits a later invocation to retry', async () => {
    const uploadFailure = new Error('upload failed');
    engine.upload_assets.mockRejectedValueOnce(uploadFailure);
    const options = { zephyr_engine: engine, assetsMap: {} } as never;

    await expect(uploadAssets(options)).rejects.toBe(uploadFailure);
    await expect(uploadAssets(options)).resolves.toEqual({
      versionUrl: null,
      targetUrls: [],
    });

    expect(engine.build_failed).toHaveBeenCalledTimes(1);
    expect(engine.start_new_build).toHaveBeenCalledTimes(2);
    expect(engine.build_finished).toHaveBeenCalledTimes(1);
  });

  it('passes every sidecar config and build-stat entry without selecting a first config', async () => {
    const mfConfigs = [
      { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
      { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' },
    ];
    const federation = [
      { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
      { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs' },
    ];
    const assetsMap = {};

    await uploadAssets({
      zephyr_engine: engine as never,
      assetsMap,
      publicationMetadata: { mfConfigs, federation },
    });

    const uploadProps = engine.upload_assets.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(uploadProps).toMatchObject({
      assetsMap,
      buildStats: { federation },
      mfConfigs,
    });
    expect(uploadProps).not.toHaveProperty('mfConfig');
  });

  it('returns the URLs captured before build_finished resets them', async () => {
    const urls = {
      version_url: 'https://acme-1-site-acme.zephyrcloud.app',
      target_urls: ['https://site-acme.zephyrcloud.app'],
    };
    Object.assign(engine, urls);
    engine.build_finished.mockImplementationOnce(async () => {
      Object.assign(engine, { version_url: null, target_urls: null });
    });

    await expect(
      uploadAssets({ zephyr_engine: engine as never, assetsMap: {} })
    ).resolves.toEqual({
      versionUrl: urls.version_url,
      targetUrls: urls.target_urls,
    });
    Object.assign(engine, { version_url: undefined, target_urls: undefined });
  });
});
