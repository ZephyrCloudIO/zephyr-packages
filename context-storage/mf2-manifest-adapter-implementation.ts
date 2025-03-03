/**
 * MF2ManifestAdapter - Adapter for converting between Module Federation 2.0 manifest
 * format and Zephyr's Snapshot format.
 */

/**
 * MF 2.0 Manifest Interface
 */
interface MF2Manifest {
  id: string;
  name: string;
  metaData: {
    name: string;
    publicPath: string;
    type?: string;
    buildInfo: {
      buildVersion: string;
    };
    remoteEntry: {
      name: string;
      path: string;
      type: string;
    };
    types?: {
      name?: string;
      path?: string;
      zip?: string;
      api?: string;
    };
    globalName: string;
    pluginVersion?: string;
  };
  remotes: Array<{
    federationContainerName: string;
    moduleName: string;
    alias: string;
    entry: string;
    usedIn?: string[];
  }>;
  shared: Array<{
    id: string;
    name: string;
    version: string;
    singleton?: boolean;
    requiredVersion?: string;
    assets: {
      js: {
        async: string[];
        sync: string[];
      };
      css: {
        async: string[];
        sync: string[];
      };
    };
  }>;
  exposes: Array<{
    id: string;
    name: string;
    path: string;
    assets: {
      js: {
        sync: string[];
        async: string[];
      };
      css: {
        sync: string[];
        async: string[];
      };
    };
  }>;
}

/**
 * Zephyr Snapshot Interface
 */
interface Snapshot {
  application_uid: string;
  version: string;
  snapshot_id: string;
  domain: string;
  uid: {
    build: string;
    app_name: string;
    repo: string;
    org: string;
  };
  git: {
    name?: string;
    email?: string;
    branch: string;
    commit: string;
  };
  creator: {
    name: string;
    email: string;
  };
  createdAt: number;
  mfConfig?: {
    name: string;
    filename: string;
    exposes?: Record<string, string>;
    remotes?: Record<string, string>;
    shared?: Record<string, unknown>;
  };
  assets: Record<string, SnapshotAsset>;
}

/**
 * Extended Snapshot with MF 2.0 specific data
 */
interface SnapshotExtended extends Snapshot {
  // Version of the manifest format
  _manifestVersion?: string;
  
  // MF 2.0 specific data that doesn't map directly to Zephyr format
  _mf2Data?: {
    metaData?: {
      publicPath?: string;
      type?: string;
      remoteEntry?: {
        type?: string;
      };
      types?: {
        name?: string;
        path?: string;
        zip?: string;
        api?: string;
      };
      globalName?: string;
      pluginVersion?: string;
    };
    shared?: Array<{
      id: string;
      name: string;
      version: string;
      singleton?: boolean;
      requiredVersion?: string;
      assets?: {
        js?: {
          async?: string[];
          sync?: string[];
        };
        css?: {
          async?: string[];
          sync?: string[];
        };
      };
    }>;
    remotes?: Array<{
      federationContainerName: string;
      moduleName: string;
      alias: string;
      entry: string;
      usedIn?: string[];
    }>;
    exposes?: Array<{
      id: string;
      name: string;
      path: string;
      assets?: {
        js?: {
          sync?: string[];
          async?: string[];
        };
        css?: {
          sync?: string[];
          async?: string[];
        };
      };
    }>;
  };
}

interface SnapshotAsset {
  path: string;
  extname: string;
  hash: string;
  size: number;
}

/**
 * ManifestAdapter Interface
 */
interface ManifestAdapter<T, U> {
  toZephyrSnapshot(manifest: T): U;
  fromZephyrSnapshot(snapshot: U): T;
  isValid(manifest: unknown): boolean;
}

/**
 * Adapter for Module Federation 2.0 manifests
 */
class MF2ManifestAdapter implements ManifestAdapter<MF2Manifest, Snapshot> {
  /**
   * Convert an MF 2.0 manifest to a Zephyr Snapshot
   */
  toZephyrSnapshot(mf2Manifest: MF2Manifest): SnapshotExtended {
    // Create base snapshot with required fields
    const snapshot: SnapshotExtended = {
      application_uid: mf2Manifest.id,
      version: mf2Manifest.metaData.buildInfo.buildVersion,
      snapshot_id: `${mf2Manifest.metaData.buildInfo.buildVersion}.${mf2Manifest.id}`,
      domain: mf2Manifest.metaData.publicPath,
      uid: {
        build: mf2Manifest.metaData.buildInfo.buildVersion,
        app_name: mf2Manifest.name,
        repo: '', // Not available in MF 2.0 manifest
        org: ''  // Not available in MF 2.0 manifest
      },
      git: {
        branch: '', // Not available in MF 2.0 manifest
        commit: ''  // Not available in MF 2.0 manifest
      },
      creator: {
        name: '', // Not available in MF 2.0 manifest
        email: '' // Not available in MF 2.0 manifest
      },
      createdAt: Date.now(),
      mfConfig: {
        name: mf2Manifest.name,
        filename: mf2Manifest.metaData.remoteEntry.name,
        // Convert exposes from array to record
        exposes: this.convertExposesToRecord(mf2Manifest.exposes),
        // Convert remotes from array to record
        remotes: this.convertRemotesToRecord(mf2Manifest.remotes),
        // Convert shared from array to record
        shared: this.convertSharedToRecord(mf2Manifest.shared)
      },
      assets: this.extractAssetsFromMF2Manifest(mf2Manifest),
      
      // Add MF 2.0 specific version marker
      _manifestVersion: 'MF2.0',
      
      // Store MF 2.0 specific data that doesn't map directly
      _mf2Data: {
        metaData: {
          publicPath: mf2Manifest.metaData.publicPath,
          type: mf2Manifest.metaData.type,
          remoteEntry: {
            type: mf2Manifest.metaData.remoteEntry.type
          },
          types: mf2Manifest.metaData.types,
          globalName: mf2Manifest.metaData.globalName,
          pluginVersion: mf2Manifest.metaData.pluginVersion
        },
        shared: mf2Manifest.shared.map(shared => ({
          id: shared.id,
          name: shared.name,
          version: shared.version,
          singleton: shared.singleton,
          requiredVersion: shared.requiredVersion
        })),
        remotes: mf2Manifest.remotes.map(remote => ({
          federationContainerName: remote.federationContainerName,
          moduleName: remote.moduleName,
          alias: remote.alias,
          entry: remote.entry,
          usedIn: remote.usedIn
        })),
        exposes: mf2Manifest.exposes.map(expose => ({
          id: expose.id,
          name: expose.name,
          path: expose.path
        }))
      }
    };
    
    return snapshot;
  }
  
  /**
   * Convert a Zephyr Snapshot to an MF 2.0 manifest
   */
  fromZephyrSnapshot(snapshot: Snapshot): MF2Manifest {
    const extendedSnapshot = snapshot as SnapshotExtended;
    const mf2Data = extendedSnapshot._mf2Data || {};
    
    // Create base MF 2.0 manifest
    const manifest: MF2Manifest = {
      id: snapshot.application_uid,
      name: snapshot.mfConfig?.name || snapshot.uid.app_name,
      metaData: {
        name: snapshot.mfConfig?.name || snapshot.uid.app_name,
        publicPath: mf2Data.metaData?.publicPath || snapshot.domain,
        type: mf2Data.metaData?.type || 'app',
        buildInfo: {
          buildVersion: snapshot.version
        },
        remoteEntry: {
          name: snapshot.mfConfig?.filename || 'remoteEntry.js',
          path: '',
          type: mf2Data.metaData?.remoteEntry?.type || 'module'
        },
        types: mf2Data.metaData?.types || {
          name: '',
          path: ''
        },
        globalName: mf2Data.metaData?.globalName || snapshot.mfConfig?.name || snapshot.uid.app_name,
        pluginVersion: mf2Data.metaData?.pluginVersion || ''
      },
      remotes: this.convertRecordToRemotes(snapshot.mfConfig?.remotes || {}, mf2Data.remotes),
      shared: this.convertRecordToShared(snapshot.mfConfig?.shared || {}, mf2Data.shared),
      exposes: this.convertRecordToExposes(snapshot.mfConfig?.exposes || {}, mf2Data.exposes, snapshot.assets)
    };
    
    return manifest;
  }
  
  /**
   * Check if a given object is a valid MF 2.0 manifest
   */
  isValid(manifest: unknown): manifest is MF2Manifest {
    if (typeof manifest !== 'object' || manifest === null) {
      return false;
    }
    
    const m = manifest as Partial<MF2Manifest>;
    
    return (
      typeof m.id === 'string' &&
      typeof m.name === 'string' &&
      typeof m.metaData === 'object' &&
      Array.isArray(m.remotes) &&
      Array.isArray(m.shared) &&
      Array.isArray(m.exposes)
    );
  }
  
  /**
   * Detect the format of a manifest
   */
  detectFormat(manifest: unknown): 'MF2' | 'ZEPHYR' | 'UNKNOWN' {
    if (typeof manifest !== 'object' || manifest === null) {
      return 'UNKNOWN';
    }
    
    // Check for MF 2.0 pattern
    if (
      'id' in manifest &&
      'name' in manifest &&
      'metaData' in manifest &&
      'remotes' in manifest &&
      'shared' in manifest &&
      'exposes' in manifest
    ) {
      return 'MF2';
    }
    
    // Check for Zephyr pattern
    if (
      'application_uid' in manifest &&
      'version' in manifest &&
      'snapshot_id' in manifest &&
      'assets' in manifest
    ) {
      return 'ZEPHYR';
    }
    
    return 'UNKNOWN';
  }
  
  /**
   * Helper to convert MF 2.0 exposes array to Zephyr record format
   */
  private convertExposesToRecord(exposes: MF2Manifest['exposes']): Record<string, string> {
    return exposes.reduce((acc, expose) => {
      acc[expose.name] = expose.path;
      return acc;
    }, {} as Record<string, string>);
  }
  
  /**
   * Helper to convert MF 2.0 remotes array to Zephyr record format
   */
  private convertRemotesToRecord(remotes: MF2Manifest['remotes']): Record<string, string> {
    return remotes.reduce((acc, remote) => {
      acc[remote.alias] = remote.entry;
      return acc;
    }, {} as Record<string, string>);
  }
  
  /**
   * Helper to convert MF 2.0 shared array to Zephyr record format
   */
  private convertSharedToRecord(shared: MF2Manifest['shared']): Record<string, unknown> {
    return shared.reduce((acc, item) => {
      acc[item.name] = {
        singleton: item.singleton,
        requiredVersion: item.requiredVersion,
        version: item.version
      };
      return acc;
    }, {} as Record<string, unknown>);
  }
  
  /**
   * Helper to convert Zephyr remotes record to MF 2.0 remotes array
   */
  private convertRecordToRemotes(
    remotesRecord: Record<string, string>,
    mf2Remotes?: SnapshotExtended['_mf2Data']['remotes']
  ): MF2Manifest['remotes'] {
    return Object.entries(remotesRecord).map(([alias, entry]) => {
      // Try to find matching remote in MF 2.0 data
      const matchingRemote = mf2Remotes?.find(r => r.alias === alias);
      
      return {
        federationContainerName: matchingRemote?.federationContainerName || alias,
        moduleName: matchingRemote?.moduleName || alias,
        alias,
        entry,
        usedIn: matchingRemote?.usedIn || []
      };
    });
  }
  
  /**
   * Helper to convert Zephyr shared record to MF 2.0 shared array
   */
  private convertRecordToShared(
    sharedRecord: Record<string, unknown>,
    mf2Shared?: SnapshotExtended['_mf2Data']['shared']
  ): MF2Manifest['shared'] {
    return Object.entries(sharedRecord).map(([name, config]) => {
      const sharedConfig = config as { singleton?: boolean; requiredVersion?: string; version?: string };
      
      // Try to find matching shared in MF 2.0 data
      const matchingShared = mf2Shared?.find(s => s.name === name);
      
      return {
        id: matchingShared?.id || `${name}`,
        name,
        version: sharedConfig.version || matchingShared?.version || '0.0.0',
        singleton: sharedConfig.singleton || matchingShared?.singleton,
        requiredVersion: sharedConfig.requiredVersion || matchingShared?.requiredVersion,
        assets: matchingShared?.assets || {
          js: { async: [], sync: [] },
          css: { async: [], sync: [] }
        }
      };
    });
  }
  
  /**
   * Helper to convert Zephyr exposes record to MF 2.0 exposes array
   */
  private convertRecordToExposes(
    exposesRecord: Record<string, string>,
    mf2Exposes?: SnapshotExtended['_mf2Data']['exposes'],
    assets?: Snapshot['assets']
  ): MF2Manifest['exposes'] {
    return Object.entries(exposesRecord).map(([name, path]) => {
      // Try to find matching expose in MF 2.0 data
      const matchingExpose = mf2Exposes?.find(e => e.name === name);
      
      return {
        id: matchingExpose?.id || `${name}`,
        name,
        path,
        assets: matchingExpose?.assets || this.generateAssetsForExpose(name, assets || {})
      };
    });
  }
  
  /**
   * Helper to generate assets structure for an expose
   */
  private generateAssetsForExpose(
    exposeName: string,
    assets: Record<string, SnapshotAsset>
  ): MF2Manifest['exposes'][0]['assets'] {
    // This is a placeholder implementation
    // In a real implementation, we would need to analyze the assets and determine
    // which ones are related to this expose and whether they are sync or async
    
    return {
      js: {
        sync: [],
        async: []
      },
      css: {
        sync: [],
        async: []
      }
    };
  }
  
  /**
   * Extract assets from MF 2.0 manifest
   */
  private extractAssetsFromMF2Manifest(mf2Manifest: MF2Manifest): Record<string, SnapshotAsset> {
    const result: Record<string, SnapshotAsset> = {};
    
    // Process assets from exposes
    mf2Manifest.exposes.forEach(expose => {
      this.processAssets(expose.assets, result);
    });
    
    // Process assets from shared
    mf2Manifest.shared.forEach(shared => {
      this.processAssets(shared.assets, result);
    });
    
    return result;
  }
  
  /**
   * Process assets and add them to the result
   */
  private processAssets(
    assets: { js: { sync: string[]; async: string[] }; css: { sync: string[]; async: string[] } },
    result: Record<string, SnapshotAsset>
  ): void {
    // Process JS assets
    [...assets.js.sync, ...assets.js.async].forEach(assetPath => {
      const parts = assetPath.split('/');
      const filename = parts[parts.length - 1];
      const [name, hash] = filename.split('.');
      
      result[assetPath] = {
        path: assetPath,
        extname: '.js',
        hash: hash || '',
        size: 0 // Size will be filled in later
      };
    });
    
    // Process CSS assets
    [...assets.css.sync, ...assets.css.async].forEach(assetPath => {
      const parts = assetPath.split('/');
      const filename = parts[parts.length - 1];
      const [name, hash] = filename.split('.');
      
      result[assetPath] = {
        path: assetPath,
        extname: '.css',
        hash: hash || '',
        size: 0 // Size will be filled in later
      };
    });
  }
}

// Export the adapter
export { MF2ManifestAdapter, MF2Manifest, Snapshot, SnapshotExtended };