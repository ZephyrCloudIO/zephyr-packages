import type { FederationRuntimePlugin } from '@module-federation/runtime';
import type { ZeResolvedDependency } from 'zephyr-agent';

export function generateRuntimePlugin(resolved_remotes: ZeResolvedDependency[]): string {
  const remoteMap = Object.fromEntries(
    resolved_remotes.map((remote) => [remote.normalized_js_name ?? remote.name, remote])
  );

  const runtimePlugin: FederationRuntimePlugin = {
    name: 'zephyr-runtime-remote-resolver',
    beforeInit: (args) => {
      const resolvedRemoteMap: Record<string, ZeResolvedDependency> =
        JSON.parse('__REMOTE_MAP__');

      const _windows = typeof window !== 'undefined' ? window : globalThis;

      args.userOptions.remotes.forEach((remote) => {
        const resolvedRemote = resolvedRemoteMap[remote.name];
        if (!resolvedRemote) {
          return;
        }

        const sessionEdgeURL = _windows.sessionStorage.getItem(
          resolvedRemote.application_uid
        );

        const urlOverwrite = sessionEdgeURL ?? resolvedRemote.remote_entry_url;

        // @ts-expect-error overwriting entry if needed
        remote.entry = urlOverwrite;
      });

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
