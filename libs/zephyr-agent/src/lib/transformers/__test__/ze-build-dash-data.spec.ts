import { zeBuildDashData } from '../ze-build-dash-data';
import type { ZephyrEngine } from '../../../zephyr-engine';

describe('zeBuildDashData', () => {
  it('includes the selected Zephyr environment in build stats', async () => {
    const engine = {
      snapshotId: Promise.resolve('snapshot-id'),
      build_id: Promise.resolve('build-id'),
      application_uid: 'app.repo.org',
      env: {
        isCI: false,
        target: 'web',
        env: 'staging',
      },
      gitProperties: {
        git: {
          name: 'User',
          email: 'user@example.com',
          branch: 'main',
          commit: 'abc123',
        },
      },
      applicationProperties: {
        org: 'org',
        project: 'repo',
        name: 'app',
        version: '1.0.0',
      },
      application_configuration: Promise.resolve({
        EDGE_URL: 'https://edge.example.com',
        username: 'user',
        DELIMITER: '-',
      }),
      npmProperties: {
        dependencies: {},
        devDependencies: {},
        optionalDependencies: {},
        peerDependencies: {},
      },
      federated_dependencies: null,
      zephyr_dependencies: {},
      ze_env_vars: null,
      ze_env_vars_hash: null,
    } as unknown as ZephyrEngine;

    const stats = await zeBuildDashData(engine);

    expect(stats.environment).toBe('staging');
    expect(stats.context).toMatchObject({
      env: 'staging',
      target: 'web',
    });
  });
});
