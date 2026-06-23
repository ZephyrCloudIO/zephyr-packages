import { ze_log } from 'zephyr-agent';
import type { XFederatedRemotesConfig, XPackConfiguration } from '../xpack.types';

export type ZephyrFederationHmrMode = 'types-and-reload' | 'fast-refresh-compatible';

export interface ZephyrFederationHmrOptions {
  enabled?: boolean;
  mode?: ZephyrFederationHmrMode;
  preserveDevRemotes?: boolean;
  forceDtsInDev?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

export interface NormalizedZephyrFederationHmrOptions {
  enabled: boolean;
  mode: ZephyrFederationHmrMode;
  preserveDevRemotes: boolean;
  forceDtsInDev: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

const DEFAULT_HMR_OPTIONS: Omit<NormalizedZephyrFederationHmrOptions, 'enabled'> = {
  mode: 'types-and-reload',
  preserveDevRemotes: true,
  forceDtsInDev: false,
  logLevel: 'info',
};

function isWatchMode(): boolean {
  return process.argv.includes('--watch') || process.argv.includes('-w');
}

function isProductionEnvironment(config: XPackConfiguration<unknown>): boolean {
  if (config.mode === 'production') {
    return true;
  }

  // Rsbuild `build --watch` still sets NODE_ENV=production, so allow watch mode
  // to keep dev-friendly HMR defaults.
  return process.env['NODE_ENV'] === 'production' && !isWatchMode();
}

export function normalizeFederationHmrOptions(
  options: boolean | ZephyrFederationHmrOptions | undefined,
  config: XPackConfiguration<unknown>
): NormalizedZephyrFederationHmrOptions {
  const defaultEnabled = !isProductionEnvironment(config);

  if (options === false) {
    return {
      enabled: false,
      ...DEFAULT_HMR_OPTIONS,
    };
  }

  if (options === true || options === undefined) {
    return {
      enabled: defaultEnabled,
      ...DEFAULT_HMR_OPTIONS,
    };
  }

  return {
    enabled: options.enabled ?? defaultEnabled,
    mode: options.mode ?? DEFAULT_HMR_OPTIONS.mode,
    preserveDevRemotes:
      options.preserveDevRemotes ?? DEFAULT_HMR_OPTIONS.preserveDevRemotes,
    forceDtsInDev: options.forceDtsInDev ?? DEFAULT_HMR_OPTIONS.forceDtsInDev,
    logLevel: options.logLevel ?? DEFAULT_HMR_OPTIONS.logLevel,
  };
}

export function isLocalDevRemote(remoteVersion: string): boolean {
  if (!remoteVersion || typeof remoteVersion !== 'string') {
    return false;
  }

  const normalized = remoteVersion.toLowerCase();

  return (
    normalized.includes('localhost') ||
    normalized.includes('127.0.0.1') ||
    normalized.includes('0.0.0.0') ||
    normalized.includes('.local') ||
    normalized.includes('mf-manifest.json')
  );
}

export function shouldPreserveLocalDevRemotes(
  options: NormalizedZephyrFederationHmrOptions,
  config: XPackConfiguration<unknown>
): boolean {
  if (!options.enabled || !options.preserveDevRemotes) {
    return false;
  }

  return !isProductionEnvironment(config);
}

function warnDts(message: string): void {
  ze_log.mf(`[federationHmr] ${message}`);
}

export function applyFederationDtsOptions(
  remotesConfig: XFederatedRemotesConfig,
  options: NormalizedZephyrFederationHmrOptions,
  config: XPackConfiguration<unknown>
): void {
  if (!options.enabled) {
    return;
  }

  // This behavior is specifically intended for dev/live workflows.
  if (isProductionEnvironment(config)) {
    return;
  }

  const dts = remotesConfig.dts;
  if (dts === false) {
    if (!options.forceDtsInDev) {
      warnDts(
        `Skipping DTS HMR parity for "${remotesConfig.name}" because dts=false is explicitly set.`
      );
      return;
    }

    remotesConfig.dts = {
      consumeTypes: {
        typesOnBuild: true,
      },
    };
    return;
  }

  if (dts === true || dts === undefined) {
    remotesConfig.dts = {
      consumeTypes: {
        typesOnBuild: true,
      },
    };
    return;
  }

  const consumeTypes = dts.consumeTypes;
  if (consumeTypes === false && !options.forceDtsInDev) {
    warnDts(
      `Skipping DTS consume-types override for "${remotesConfig.name}" because dts.consumeTypes=false is explicitly set.`
    );
    return;
  }

  const normalizedConsumeTypes =
    consumeTypes === true || consumeTypes === undefined
      ? {}
      : { ...consumeTypes, typesOnBuild: true };

  remotesConfig.dts = {
    ...dts,
    consumeTypes: {
      ...normalizedConsumeTypes,
      typesOnBuild: true,
    },
  };
}
