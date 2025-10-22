import type { FederationRuntimePlugin } from '@module-federation/runtime';
import type { ZeResolvedDependency } from 'zephyr-agent';

export function generateRuntimePlugin(resolved_remotes: ZeResolvedDependency[]): string {
  const remoteMap = Object.fromEntries(
    resolved_remotes.map((remote) => [remote.name, remote])
  );

  const runtimePlugin: FederationRuntimePlugin = {
    name: 'zephyr-runtime-remote-resolver',
    beforeInit: (args) => {
      console.log('🚀 ZEPHYR RUNTIME PLUGIN: beforeInit called!');
      console.log(
        '🚀 ZEPHYR RUNTIME PLUGIN: args.userOptions.remotes:',
        args.userOptions.remotes
      );

      const resolvedRemoteMap: Record<string, ZeResolvedDependency> =
        JSON.parse('__REMOTE_MAP__');
      console.log('🚀 ZEPHYR RUNTIME PLUGIN: resolvedRemoteMap:', resolvedRemoteMap);

      const _windows = typeof window !== 'undefined' ? window : globalThis;
      console.log('🚀 ZEPHYR RUNTIME PLUGIN: _windows:', _windows);

      args.userOptions.remotes.forEach((remote) => {
        console.log(
          '🚀 ZEPHYR RUNTIME PLUGIN: Processing remote:',
          remote.name,
          'original remote:',
          remote
        );

        const resolvedRemote = resolvedRemoteMap[remote.name];
        if (!resolvedRemote) {
          console.log(
            '🚀 ZEPHYR RUNTIME PLUGIN: No resolved remote found for:',
            remote.name
          );
          return;
        }

        const sessionEdgeURL = _windows.sessionStorage.getItem(
          resolvedRemote.application_uid
        );
        console.log(
          '🚀 ZEPHYR RUNTIME PLUGIN: sessionEdgeURL for',
          remote.name,
          ':',
          sessionEdgeURL
        );

        const urlOverwrite = sessionEdgeURL ?? resolvedRemote.remote_entry_url;
        console.log(
          '🚀 ZEPHYR RUNTIME PLUGIN: urlOverwrite for',
          remote.name,
          ':',
          urlOverwrite
        );

        // @ts-expect-error overwriting entry if needed
        remote.entry = urlOverwrite;
        console.log(
          '🚀 ZEPHYR RUNTIME PLUGIN: Updated remote for',
          remote.name,
          'to:',
          remote
        );
      });

      console.log(
        '🚀 ZEPHYR RUNTIME PLUGIN: Final args.userOptions.remotes:',
        args.userOptions.remotes
      );
      return args;
    },
  };

  return objectToTemplate(runtimePlugin).replace(
    '__REMOTE_MAP__',
    JSON.stringify(remoteMap)
  );
}

function objectToTemplate(obj: FederationRuntimePlugin): string {
  const entries = Object.entries(obj).map(([key, value]) => {
    if (typeof value === 'function') {
      return `${key}: ${value.toString()}`;
    } else if (typeof value === 'object' && value !== null) {
      return `${key}: ${objectToTemplate(value)}`;
    } else if (typeof value === 'string') {
      return `${key}: "${value}"`;
    } else {
      return `${key}: ${value}`;
    }
  });
  return `{ ${entries.join(', ')} }`;
}
