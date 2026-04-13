import type { ZeResolvedDependency } from 'zephyr-agent';
import type {
  ModuleFederationOptions,
  ModuleFederationRemoteConfig,
} from './ensure_runtime_plugin';

function isUrlLike(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value);
}

function getRemoteNamePrefix(value: string): string | undefined {
  const atIndex = value.lastIndexOf('@');
  if (atIndex <= 0) {
    return undefined;
  }

  const prefix = value.slice(0, atIndex);
  if (!prefix || isUrlLike(prefix)) {
    return undefined;
  }

  return prefix;
}

function withOriginalPrefix(
  originalEntry: string | undefined,
  resolvedUrl: string
): string {
  if (!originalEntry) {
    return resolvedUrl;
  }

  const prefix = getRemoteNamePrefix(originalEntry);
  if (!prefix) {
    return resolvedUrl;
  }

  return `${prefix}@${resolvedUrl}`;
}

function lookupResolvedRemote(
  key: string,
  remote: string | ModuleFederationRemoteConfig,
  resolvedByName: Record<string, ZeResolvedDependency>
): ZeResolvedDependency | undefined {
  if (resolvedByName[key]) {
    return resolvedByName[key];
  }

  if (typeof remote === 'string') {
    const prefix = getRemoteNamePrefix(remote);
    if (prefix && resolvedByName[prefix]) {
      return resolvedByName[prefix];
    }
    return undefined;
  }

  if (resolvedByName[remote.name]) {
    return resolvedByName[remote.name];
  }

  const prefix = getRemoteNamePrefix(remote.entry);
  if (prefix && resolvedByName[prefix]) {
    return resolvedByName[prefix];
  }

  return undefined;
}

export function applyResolvedRemotesFallback(
  mfConfig: ModuleFederationOptions,
  resolvedRemotes: ZeResolvedDependency[] | null
): number {
  if (!mfConfig.remotes || !resolvedRemotes?.length) {
    return 0;
  }

  const resolvedByName = Object.fromEntries(
    resolvedRemotes.map((remote) => [remote.name, remote])
  ) as Record<string, ZeResolvedDependency>;

  let updatedCount = 0;

  Object.entries(mfConfig.remotes).forEach(([key, remote]) => {
    const resolvedRemote = lookupResolvedRemote(key, remote, resolvedByName);
    if (!resolvedRemote) {
      return;
    }

    if (typeof remote === 'string') {
      mfConfig.remotes![key] = withOriginalPrefix(
        remote,
        resolvedRemote.remote_entry_url
      );
      updatedCount += 1;
      return;
    }

    remote.entry = withOriginalPrefix(remote.entry, resolvedRemote.remote_entry_url);
    updatedCount += 1;
  });

  return updatedCount;
}
