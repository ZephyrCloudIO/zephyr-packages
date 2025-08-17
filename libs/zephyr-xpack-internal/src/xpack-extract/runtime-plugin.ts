import { ZephyrDependency, ZephyrManifest } from 'zephyr-edge-contract';
import type {
  BeforeRequestHookArgs,
  FederationRuntimePlugin,
  RemoteWithEntry,
} from '../types/module-federation.types';

// Ensure only one fetch is done by the app
const globalKey = '__ZEPHYR_MANIFEST_PROMISE__';
const _global = typeof window !== 'undefined' ? window : globalThis;

function getGlobalManifestPromise(): Promise<ZephyrManifest | undefined> | undefined {
  return (_global as any)[globalKey];
}

function setGlobalManifestPromise(promise: Promise<ZephyrManifest | undefined>): void {
  (_global as any)[globalKey] = promise;
}

/**
 * Zephyr Runtime Plugin for Module Federation This plugin handles dynamic remote URL
 * resolution at runtime using beforeRequest hook to mutate URLs on the fly
 */
export function createZephyrRuntimePlugin(): FederationRuntimePlugin {
  let processedRemotes: Record<string, ZephyrDependency> | undefined;

  // Start fetching manifest immediately
  let zephyrManifestPromise = getGlobalManifestPromise();

  if (!zephyrManifestPromise) {
    zephyrManifestPromise = fetchZephyrManifest();
    setGlobalManifestPromise(zephyrManifestPromise);
  }

  return {
    name: 'zephyr-runtime-remote-resolver',
    async beforeRequest(args) {
      const zephyrManifest = await zephyrManifestPromise;

      if (!processedRemotes) {
        processedRemotes = identifyRemotes(args, zephyrManifest);
      }

      // Extract remote name from args.id (format: "remoteName/componentName")
      const remoteName = args.id.split('/')[0];

      if (!processedRemotes[remoteName]) {
        return args; // No matching remote found
      }

      // Get the resolved URL, checking session storage first
      const resolvedUrl = getResolvedRemoteUrl(processedRemotes[remoteName]);

      const targetRemote = args.options.remotes.find(
        (remote) =>
          hasEntry(remote) && (remote.name === remoteName || remote.alias === remoteName)
      )!;

      // Update the remote entry URL
      targetRemote.entry = resolvedUrl;

      return args;
    },
  };
}

/** Fetches the zephyr-manifest.json file and returns the runtime plugin data */
async function fetchZephyrManifest(): Promise<ZephyrManifest | undefined> {
  try {
    // Fetch the manifest from the same origin
    const response = await fetch('/zephyr-manifest.json');

    if (!response.ok) {
      return;
    }

    const manifest = await response.json().catch(() => undefined);

    if (!manifest) {
      console.error('Failed to parse manifest JSON');
      return;
    }

    return manifest;
  } catch {
    console.error('Unexpected error fetching manifest');
    return;
  }
}

function identifyRemotes(
  args: BeforeRequestHookArgs,
  zephyrManifest: ZephyrManifest | undefined
): Record<string, ZephyrDependency> {
  const identifiedRemotes: Record<string, ZephyrDependency> = {};

  // No runtime plugin configured
  if (!zephyrManifest) {
    return identifiedRemotes;
  }

  // No remotes defined
  if (!args.options.remotes.length) {
    return identifiedRemotes;
  }

  const { dependencies } = zephyrManifest;

  const remotes = args.options.remotes;

  remotes.forEach((remote) => {
    const resolvedRemote = dependencies[remote.name] ?? dependencies[remote.alias ?? ''];
    if (resolvedRemote) {
      identifiedRemotes[resolvedRemote.name] = resolvedRemote;
    }
  });

  return identifiedRemotes;
}

function hasEntry(remote: any): remote is RemoteWithEntry {
  return (
    remote !== null &&
    remote !== undefined &&
    typeof remote === 'object' &&
    'entry' in remote &&
    typeof (remote as any).entry === 'string'
  );
}

/** Resolves the actual remote URL, checking session storage for overrides */
function getResolvedRemoteUrl(resolvedRemote: ZephyrDependency): string {
  const _window = typeof window !== 'undefined' ? window : globalThis;

  // Check for session storage override (for development/testing)
  const sessionEdgeURL = _window.sessionStorage?.getItem(resolvedRemote.application_uid);

  // Use session URL if available, otherwise use resolved URL
  let edgeUrl = sessionEdgeURL ?? resolvedRemote.remote_entry_url;

  // Handle versioned remotes (name@url format)
  if (edgeUrl.indexOf('@') !== -1) {
    const [, url] = edgeUrl.split('@') as [string, string];
    edgeUrl = url;
  }

  return edgeUrl;
}

/** Default export for use with Module Federation runtime plugins array */
export default createZephyrRuntimePlugin;
