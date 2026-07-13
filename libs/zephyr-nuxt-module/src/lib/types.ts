import type { ZephyrBuildHooks, ZephyrBuildTarget } from 'zephyr-agent';
import type {
  ZephyrModuleFederationBuildMetadata,
  ZephyrModuleFederationConfig,
} from 'zephyr-edge-contract';

export type SnapshotType = 'csr' | 'ssr';

export interface NitroOutputOptions {
  dir?: string;
  publicDir?: string;
}

export interface NitroLike {
  options?: {
    output?: NitroOutputOptions;
  };
}

export interface NuxtOptionsWithNitro {
  rootDir: string;
  dev?: boolean;
  app?: {
    baseURL?: string;
  };
  nitro?: {
    output?: NitroOutputOptions;
  };
}

export interface NuxtLike {
  options: NuxtOptionsWithNitro;
  hook: (name: 'close', fn: () => void | Promise<void>) => void;
}

export interface ZephyrNuxtOptions {
  /** Zephyr artifact family, including `tap-app` for TAP packages. */
  target?: ZephyrBuildTarget;
  /** Every JSON-serializable Module Federation config emitted by the package SDK. */
  mfConfigs?: ZephyrModuleFederationConfig[];
  /** Dashboard metadata paired with each entry in `mfConfigs`. */
  federation?: ZephyrModuleFederationBuildMetadata[];
  /** Override Nitro output directory (defaults to nitro.options.output.dir). */
  outputDir?: string;
  /** Explicit SSR entrypoint (relative to outputDir). */
  entrypoint?: string;
  /** Force snapshot type. Defaults to SSR if an entrypoint is found. */
  snapshotType?: SnapshotType;
  /** Optional Zephyr build hooks. */
  hooks?: ZephyrBuildHooks;
}
