import { ZeResolvedDependency } from 'zephyr-agent';

export interface ZephyrGlobal {
  remoteMap: Record<string, ZeResolvedDependency>;
}
