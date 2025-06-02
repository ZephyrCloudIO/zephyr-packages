import type { ZeDependencyPair } from 'zephyr-agent';
import { readPackageJson } from 'zephyr-agent';

export interface RemoteObjectConfig {
  type?: string;
  name: string;
  entry: string;
  entryGlobalName?: string;
  shareScope?: string;
}

export interface PartialViteMFConfig {
  remotes?: Record<string, string | RemoteObjectConfig> | undefined;
}

export function extract_remotes_dependencies(
  root: string,
  mfConfig: PartialViteMFConfig
): ZeDependencyPair[] | undefined {
  const { zephyrDependencies } = readPackageJson(root);
  if (zephyrDependencies) {
    return Object.entries(zephyrDependencies).map(([name, version]) => {
      return {
        name,
        version,
      } as ZeDependencyPair;
    });
  }

  if (!mfConfig.remotes) return;

  const dependencyPairs: ZeDependencyPair[] = Object.entries(mfConfig.remotes).map(
    ([name, remote]) => {
      if (typeof remote === 'string') {
        return { name, version: remote };
      }
      return { name, version: remote.entry };
    }
  );

  return dependencyPairs;
}
