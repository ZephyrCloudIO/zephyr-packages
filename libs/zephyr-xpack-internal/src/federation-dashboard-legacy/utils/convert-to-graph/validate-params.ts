/* eslint-disable no-restricted-syntax */

import { objHasKeys } from './object-has-keys';
import type { XStatsChunk, XStatsModule } from '../../../xpack.types';

export interface FederationRemoteEntry {
  origins: {
    loc: string;
  }[];

  [key: string]: FederationRemoteEntry[keyof FederationRemoteEntry];
}

export interface TopLevelPackage {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;

  [key: string]: TopLevelPackage[keyof TopLevelPackage];
}

export interface Module {
  name: string;
  identifier: string;
  reasons: Array<{
    userRequest: string;
    resolvedModule: string;
    type: string;
    module: string;
  }>;
  moduleType: string;
  issuerName?: string;
  nameForCondition: string;
  size: number;
}

interface ValidateParams {
  federationRemoteEntry: XStatsChunk | undefined;
  topLevelPackage: TopLevelPackage;
  modules: XStatsModule[] | undefined;
}

export function validateParams(
  { federationRemoteEntry, topLevelPackage, modules }: ValidateParams,
  standalone?: boolean
): void {
  const hasLoc = federationRemoteEntry
    ? objHasKeys(federationRemoteEntry, ['origins', '0', 'loc'])
    : federationRemoteEntry;

  const hasDependencies = objHasKeys(topLevelPackage, ['dependencies']);
  const hasDevDependencies = objHasKeys(topLevelPackage, ['devDependencies']);
  const hasOptionalDependencies = objHasKeys(topLevelPackage, ['optionalDependencies']);
  if (federationRemoteEntry) {
    if (
      typeof hasLoc === 'undefined' ||
      (federationRemoteEntry.origins && federationRemoteEntry.origins[0].loc === '')
    ) {
      throw new Error(
        'federationRemoteEntry.origins[0].loc must be defined and have a value'
      );
    }
  }
  if ((modules && !modules.length) || typeof modules === 'undefined') {
    if (!standalone) {
      throw new Error('Modules must be defined and have length');
    }
  }

  if (!hasDependencies) {
    throw new Error('topLevelPackage.dependencies must be defined');
  }

  if (!hasDevDependencies) {
    throw new Error('topLevelPackage.devDependencies must be defined');
  }

  if (!hasOptionalDependencies) {
    throw new Error('topLevelPackage.optionalDependencies must be defined');
  }

  if (!modules) return;

  for (const module of modules) {
    if (typeof module.identifier === 'undefined') {
      throw new Error('module.identifier must be defined');
    }

    if (typeof module.reasons === 'undefined') {
      throw new Error('module.reasons must be defined');
    }

    if (
      (['consume-shared-module', 'provide-module', 'remote-module'].includes(
        module.moduleType ?? ''
      ) ||
        module.name?.includes('container entry')) &&
      typeof module.issuerName === 'undefined'
    ) {
      throw new Error('module.issuerName must be defined');
    }
  }
}
