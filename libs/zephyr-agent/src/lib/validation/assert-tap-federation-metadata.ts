import type {
  ZephyrBuildTarget,
  ZephyrModuleFederationBuildMetadata,
  ZephyrModuleFederationConfig,
} from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';

export interface TapFederationPublicationMetadata {
  target: ZephyrBuildTarget | undefined;
  mfConfigs: readonly ZephyrModuleFederationConfig[] | undefined;
  federation: readonly ZephyrModuleFederationBuildMetadata[] | undefined;
}

function publicationError(message: string): Error {
  return new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, { message });
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * A TAP package is addressed by a pair of independently persisted metadata arrays: the
 * snapshot's Module Federation configurations and the build-stat remote records. Keep
 * this assertion at the transport boundary so every adapter, including a future one that
 * bypasses a framework-specific helper, fails before it can publish an incomplete or
 * ambiguous package.
 */
export function assertTapFederationPublicationMetadata({
  target,
  mfConfigs,
  federation,
}: TapFederationPublicationMetadata): void {
  if (target !== 'tap-app') {
    return;
  }

  if (!Array.isArray(mfConfigs) || mfConfigs.length === 0) {
    throw publicationError(
      'tap-app publication requires a non-empty mfConfigs metadata array.'
    );
  }
  if (!Array.isArray(federation) || federation.length === 0) {
    throw publicationError(
      'tap-app publication requires a non-empty federation metadata array.'
    );
  }
  if (mfConfigs.length !== federation.length) {
    throw publicationError(
      'tap-app mfConfigs and federation metadata must contain the same number of containers.'
    );
  }

  const federationByName = new Map<string, ZephyrModuleFederationBuildMetadata>();
  const federationRemotes = new Set<string>();
  for (const entry of federation) {
    if (!nonEmptyString(entry.name) || !nonEmptyString(entry.remote)) {
      throw publicationError(
        'tap-app federation metadata requires a non-empty name and remote for every container.'
      );
    }
    if (federationByName.has(entry.name) || federationRemotes.has(entry.remote)) {
      throw publicationError(
        'tap-app federation metadata entries must not duplicate names or remotes.'
      );
    }
    federationByName.set(entry.name, entry);
    federationRemotes.add(entry.remote);
  }

  const configNames = new Set<string>();
  const configFilenames = new Set<string>();
  for (const config of mfConfigs) {
    if (!nonEmptyString(config.name) || !nonEmptyString(config.filename)) {
      throw publicationError(
        'tap-app mfConfigs requires a non-empty name and filename for every container.'
      );
    }
    if (configNames.has(config.name) || configFilenames.has(config.filename)) {
      throw publicationError(
        'tap-app mfConfigs entries must not duplicate names or filenames.'
      );
    }
    if (federationByName.get(config.name)?.remote !== config.filename) {
      throw publicationError(
        `tap-app federation metadata has no matching name and remote for mfConfigs entry ${JSON.stringify(config.name)} at ${JSON.stringify(config.filename)}.`
      );
    }
    configNames.add(config.name);
    configFilenames.add(config.filename);
  }
}
