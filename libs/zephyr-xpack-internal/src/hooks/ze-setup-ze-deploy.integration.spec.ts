import { afterEach, describe, expect, it, rs } from '@rstest/core';
import type { ZephyrEngine } from 'zephyr-agent';
import type { Source } from 'zephyr-edge-contract';
import { setupZeDeploy } from './ze-setup-ze-deploy';
import { XPackBuildCoordinator } from '../xpack-extract/xpack-build-coordinator';

rs.mock('../federation-dashboard-legacy/get-build-stats', () => ({
  getBuildStats: rs.fn(async () => ({ version: 'snapshot', app: { buildId: 'build' } })),
  getModuleFederationConfigs: rs.fn(() => []),
}));

function participant(
  engine: ZephyrEngine,
  coordinator: XPackBuildCoordinator,
  name: string,
  failBuild: boolean
) {
  let onCompilation!: (value: ReturnType<typeof compilation>) => void;
  let onInvalid!: () => void;
  setupZeDeploy(
    {
      pluginName: 'ZePlugin',
      zephyr_engine: engine,
      coordinator,
      participant: name,
      failBuild,
    },
    {
      webpack: { Compilation: { PROCESS_ASSETS_STAGE_REPORT: 1000 } },
      hooks: {
        thisCompilation: {
          tap: (_name, callback) => {
            onCompilation = callback;
          },
        },
        afterEmit: { tapPromise: rs.fn() },
        invalid: {
          tap: (_name, callback) => {
            onInvalid = callback;
          },
        },
      },
    }
  );
  return {
    invalidate: () => onInvalid(),
    begin: () => {
      const current = compilation(name);
      onCompilation(current);
      return current;
    },
  };
}

function compilation(name: string) {
  let processAssets: ((assets: Record<string, Source>) => Promise<void>) | undefined;
  return {
    getStats: () => ({ toJson: () => ({}) }),
    hooks: {
      processAssets: {
        tapPromise: (
          _options: unknown,
          callback: (assets: Record<string, Source>) => Promise<void>
        ) => {
          processAssets = callback;
        },
      },
    },
    upload: () => processAssets?.({ [`${name}.js`]: { source: () => name } as Source }),
  };
}

describe('coordinated deploy error policy', () => {
  afterEach(() => rs.restoreAllMocks());

  it.each([false, true])(
    'handles a late sibling after a build-ID outage with failBuild=%s and recovers',
    async (failBuild) => {
      rs.spyOn(console, 'log').mockImplementation(() => undefined);
      rs.spyOn(console, 'error').mockImplementation(() => undefined);
      const engine = {
        application_uid: 'coordinated.test',
        env: { target: 'web' },
        buildProperties: { output: './dist' },
        application_configuration: Promise.resolve({
          EDGE_URL: 'edge',
          PLATFORM: 'web',
          DELIMITER: '.',
        }),
        start_new_build: rs.fn(async () => undefined),
        upload_assets: rs.fn(async () => undefined),
        build_finished: rs.fn(async () => undefined),
        build_failed: rs.fn(),
      } as unknown as ZephyrEngine;
      const coordinator = new XPackBuildCoordinator(engine, [
        { name: 'client' },
        { name: 'server' },
      ]);
      const client = participant(engine, coordinator, 'client', failBuild);
      const server = participant(engine, coordinator, 'server', failBuild);

      await client.begin().upload();
      await server.begin().upload();
      expect(engine.upload_assets).toHaveBeenCalledTimes(1);

      client.invalidate();
      rs.mocked(engine.start_new_build).mockRejectedValueOnce(
        new Error('build-ID outage')
      );
      const upload = client.begin().upload();
      if (failBuild) {
        await expect(upload).rejects.toThrow('build-ID outage');
        expect(() => server.begin()).toThrow('belongs to a failed logical build');
      } else {
        await expect(upload).resolves.toBeUndefined();
        await server.begin().upload();
      }
      expect(engine.upload_assets).toHaveBeenCalledTimes(1);

      client.invalidate();
      await client.begin().upload();
      expect(engine.upload_assets).toHaveBeenCalledTimes(1);
      server.invalidate();
      await server.begin().upload();
      expect(engine.upload_assets).toHaveBeenCalledTimes(2);
    }
  );
});
