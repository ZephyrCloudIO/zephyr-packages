import { getInstance } from '@module-federation/runtime';
import type { ZephyrDependencyConfig } from '../types';
import { createScopedLogger } from './logger';

const logger = createScopedLogger('DetectRemotes');

/** Represents a detected remote from the Module Federation runtime */
export interface DetectedRemote {
  /** The name of the remote as configured in Module Federation */
  name: string;

  /** Application UID in format: appName.projectName.orgName */
  applicationUid: string;

  /** The current environment/tag configured in the entry */
  currentEnvironment: string;
}

/** Internal type for MF remote configuration */
interface MFRemoteConfig {
  name: string;
  entry?: string;
  alias?: string;
}

/**
 * Auto-detect remotes from Module Federation runtime. Extracts remote names and their
 * application UIDs from the MF host.
 *
 * @example
 *   ```ts
 *   const remotes = detectRemotesFromRuntime();
 *   // Returns: [
 *   //   { name: 'MFTextEditor', applicationUid: 'mftexteditor.myproject.myorg', currentEnvironment: 'staging' },
 *   //   { name: 'MFNotesList', applicationUid: 'mfnoteslist.myproject.myorg', currentEnvironment: 'staging' }
 *   // ]
 *   ```;
 *
 * @returns Array of detected remotes with zephyr: protocol entries
 */
export function detectRemotesFromRuntime(): DetectedRemote[] {
  try {
    const federationHost = getInstance();

    if (!federationHost) {
      logger.debug('No Module Federation host instance found');
      return [];
    }

    // Access the options from the federation host
    // The options contain the remotes configuration
    const options = (federationHost as { options?: { remotes?: MFRemoteConfig[] } })
      .options;

    if (!options?.remotes) {
      logger.debug('No remotes found in MF host options');
      return [];
    }

    const detectedRemotes: DetectedRemote[] = [];

    for (const remote of options.remotes) {
      const entry = remote.entry;

      // Only process zephyr: protocol entries
      if (!entry || !entry.startsWith('zephyr:')) {
        logger.debug(`Skipping non-zephyr remote: ${remote.name}`);
        continue;
      }

      // Parse 'zephyr:appName.projectName.orgName@environment'
      const match = entry.match(/^zephyr:(.+)@(.+)$/);

      if (!match) {
        logger.warn(`Invalid zephyr protocol format for remote ${remote.name}: ${entry}`);
        continue;
      }

      const [, applicationUid, currentEnvironment] = match;

      detectedRemotes.push({
        name: remote.name,
        applicationUid,
        currentEnvironment,
      });

      logger.debug(
        `Detected remote: ${remote.name} -> ${applicationUid}@${currentEnvironment}`
      );
    }

    logger.info(`Auto-detected ${detectedRemotes.length} zephyr remotes`);
    return detectedRemotes;
  } catch (error) {
    logger.error('Failed to detect remotes from MF runtime:', error);
    return [];
  }
}

/** Environment overrides for specific remotes. Maps remote name to its environment. */
export type EnvironmentOverrides = Record<string, string>;

/**
 * Build dependencies config from detected remotes and a target environment.
 *
 * @example
 *   ```ts
 *   const remotes = detectRemotesFromRuntime();
 *   const deps = buildDependenciesConfig(remotes, 'staging', {
 *     MFTextEditor: 'production'  // Use production for this remote
 *   });
 *   // Returns: {
 *   //   MFTextEditor: 'zephyr:mftexteditor.myproject.myorg@production',
 *   //   MFNotesList: 'zephyr:mfnoteslist.myproject.myorg@staging'
 *   // }
 *   ```;
 *
 * @param detectedRemotes - Remotes detected from MF runtime
 * @param environment - Target environment (e.g., 'staging', 'production')
 * @param overrides - Optional per-remote environment overrides
 * @returns Dependencies config ready for use with ZephyrOTAService
 */
export function buildDependenciesConfig(
  detectedRemotes: DetectedRemote[],
  environment: string,
  overrides?: EnvironmentOverrides
): ZephyrDependencyConfig {
  const deps: ZephyrDependencyConfig = {};

  for (const remote of detectedRemotes) {
    // Use override if provided, otherwise use default environment
    const env = overrides?.[remote.name] ?? environment;
    deps[remote.name] = `zephyr:${remote.applicationUid}@${env}`;

    logger.debug(`Built dependency: ${remote.name} -> ${deps[remote.name]}`);
  }

  return deps;
}
