import type { ZeResolvedDependency } from 'zephyr-agent';
import type { ModuleFederationOptions } from '../ensure_runtime_plugin';
import { applyResolvedRemotesFallback } from '../apply_resolved_remotes_fallback';

function createResolvedRemote(
  name: string,
  remoteEntryUrl: string
): ZeResolvedDependency {
  return {
    name,
    version: 'latest',
    application_uid: `org.project.${name}`,
    default_url: remoteEntryUrl,
    remote_entry_url: remoteEntryUrl,
    library_type: 'module',
  };
}

describe('applyResolvedRemotesFallback', () => {
  test('updates string remotes while preserving MF name@url prefix', () => {
    const mfConfig: ModuleFederationOptions = {
      name: 'host',
      remotes: {
        remote_alias: 'remoteApp@http://localhost:3001/remoteEntry.js',
      },
    };

    const updated = applyResolvedRemotesFallback(mfConfig, [
      createResolvedRemote('remote_alias', 'https://edge.example.com/remoteEntry.js'),
    ]);

    expect(updated).toBe(1);
    expect(mfConfig.remotes?.['remote_alias']).toBe(
      'remoteApp@https://edge.example.com/remoteEntry.js'
    );
  });

  test('updates object remotes by key and preserves entry prefix format', () => {
    const mfConfig: ModuleFederationOptions = {
      name: 'host',
      remotes: {
        remote_alias: {
          name: 'remoteApp',
          entry: 'remoteApp@http://localhost:3001/remoteEntry.js',
          type: 'module',
        },
      },
    };

    const updated = applyResolvedRemotesFallback(mfConfig, [
      createResolvedRemote('remote_alias', 'https://edge.example.com/remoteEntry.js'),
    ]);

    expect(updated).toBe(1);
    expect(
      typeof mfConfig.remotes?.['remote_alias'] === 'object' &&
        mfConfig.remotes?.['remote_alias']?.entry
    ).toBe('remoteApp@https://edge.example.com/remoteEntry.js');
  });

  test('keeps original values when no resolved remote exists', () => {
    const mfConfig: ModuleFederationOptions = {
      name: 'host',
      remotes: {
        remote_alias: 'remoteApp@http://localhost:3001/remoteEntry.js',
      },
    };

    const updated = applyResolvedRemotesFallback(mfConfig, [
      createResolvedRemote('different_remote', 'https://edge.example.com/remoteEntry.js'),
    ]);

    expect(updated).toBe(0);
    expect(mfConfig.remotes?.['remote_alias']).toBe(
      'remoteApp@http://localhost:3001/remoteEntry.js'
    );
  });
});
