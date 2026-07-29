import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  remotesLog: rs.fn(),
  iterate: rs.fn(),
  parseRemotes: rs.fn(),
  isLegacy: rs.fn(),
  insertRuntimePlugin: rs.fn(),
  createRuntimeCode: rs.fn(),
  normalizeAppName: rs.fn((name: string) => name),
}));

rs.mock('zephyr-agent', () => ({
  ze_log: { remotes: mocks.remotesLog },
}));

rs.mock('zephyr-edge-contract', () => ({
  normalize_app_name: mocks.normalizeAppName,
}));

rs.mock('./iterate-federated-remote-config', () => ({
  iterateFederatedRemoteConfig: mocks.iterate,
}));

rs.mock('./extract-federated-dependency-pairs', () => ({
  parseRemotesAsEntries: mocks.parseRemotes,
}));

rs.mock('./is-legacy-mf-plugin', () => ({
  isLegacyMFPlugin: mocks.isLegacy,
}));

rs.mock('./runtime-plugin-insert', () => ({
  runtimePluginInsert: mocks.insertRuntimePlugin,
}));

rs.mock('./index', () => ({
  createMfRuntimeCode: mocks.createRuntimeCode,
  xpack_delegate_module_template: rs.fn(),
}));

import { mutWebpackFederatedRemotesConfig } from './mut-webpack-federated-remotes-config';

function engine(target: 'web' | 'tap-app') {
  return { env: { target }, builder: 'webpack' } as never;
}

const resolvedDependency = {
  name: 'shell',
  version: '1.0.0',
  application_uid: 'org.project.shell',
  remote_entry_url: 'https://edge.example.test/shell/remoteEntry.mjs',
  library_type: 'module',
};

describe('mutWebpackFederatedRemotesConfig', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('does not rewrite SDK-locked TAP remotes or inject a runtime plugin', () => {
    const remotes = { shell: 'shell@https://sdk.example.test/remoteEntry.mjs' };

    mutWebpackFederatedRemotesConfig(
      engine('tap-app'),
      { plugins: [] } as never,
      [resolvedDependency] as never
    );

    expect(mocks.iterate).not.toHaveBeenCalled();
    expect(mocks.insertRuntimePlugin).not.toHaveBeenCalled();
    expect(remotes).toEqual({ shell: 'shell@https://sdk.example.test/remoteEntry.mjs' });
  });

  it('retains conventional remote rewriting for web builds', () => {
    const remotes = { shell: 'shell@https://sdk.example.test/remoteEntry.mjs' };
    mocks.iterate.mockImplementation((_config, callback) => {
      callback({ remotes, library: { type: 'module' } }, {});
    });
    mocks.parseRemotes.mockReturnValue([
      ['shell', 'shell@https://sdk.example.test/remoteEntry.mjs'],
    ]);
    mocks.isLegacy.mockReturnValue(true);
    mocks.createRuntimeCode.mockReturnValue(
      'shell@https://edge.example.test/shell/remoteEntry.mjs'
    );

    mutWebpackFederatedRemotesConfig(
      engine('web'),
      { plugins: [] } as never,
      [resolvedDependency] as never
    );

    expect(remotes.shell).toBe('shell@https://edge.example.test/shell/remoteEntry.mjs');
  });

  it('passes the resolved self manifest URL into enhanced runtime plugin insertion', () => {
    const remotes = { shell: 'shell@https://sdk.example.test/remoteEntry.mjs' };
    mocks.iterate.mockImplementation((_config, callback) => {
      callback({ remotes, library: { type: 'module' } }, {});
    });
    mocks.parseRemotes.mockReturnValue([
      ['shell', 'shell@https://sdk.example.test/remoteEntry.mjs'],
    ]);
    mocks.isLegacy.mockReturnValue(false);
    mocks.insertRuntimePlugin.mockReturnValue(true);

    mutWebpackFederatedRemotesConfig(
      engine('web'),
      { plugins: [] } as never,
      [resolvedDependency] as never,
      undefined,
      'https://cdn.example.test/customer/app/zephyr-manifest.json'
    );

    expect(mocks.insertRuntimePlugin).toHaveBeenCalledWith(
      expect.anything(),
      'https://cdn.example.test/customer/app/zephyr-manifest.json'
    );
  });
});
