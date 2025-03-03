/**
 * Manifest Validation Utilities
 * 
 * This module provides validation utilities for both Module Federation 1.0, 2.0,
 * and Zephyr manifest formats.
 */

/**
 * Type definitions for the manifests
 */

// MF 2.0 Manifest Interface
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

// Zephyr Snapshot Interface
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

interface SnapshotAsset {
  path: string;
  extname: string;
  hash: string;
  size: number;
}

// Extended Snapshot with MF 2.0 specific data
interface SnapshotExtended extends Snapshot {
  _manifestVersion?: string;
  _mf2Data?: Record<string, unknown>;
}

/**
 * Validation result interface
 */
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  path: string;
  message: string;
  code: string;
}

/**
 * Manifest format enum
 */
enum ManifestFormat {
  MF2 = 'MF2',
  ZEPHYR = 'ZEPHYR',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Detect the format of a manifest
 */
function detectManifestFormat(manifest: unknown): ManifestFormat {
  if (typeof manifest !== 'object' || manifest === null) {
    return ManifestFormat.UNKNOWN;
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
    return ManifestFormat.MF2;
  }
  
  // Check for Zephyr pattern
  if (
    'application_uid' in manifest &&
    'version' in manifest &&
    'snapshot_id' in manifest &&
    'assets' in manifest
  ) {
    return ManifestFormat.ZEPHYR;
  }
  
  return ManifestFormat.UNKNOWN;
}

/**
 * Validate an MF 2.0 manifest
 */
function validateMF2Manifest(manifest: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (typeof manifest !== 'object' || manifest === null) {
    errors.push({
      path: '',
      message: 'Manifest must be an object',
      code: 'INVALID_TYPE'
    });
    return { valid: false, errors };
  }
  
  const m = manifest as Partial<MF2Manifest>;
  
  // Check required root fields
  const requiredRootFields = ['id', 'name', 'metaData', 'remotes', 'shared', 'exposes'];
  requiredRootFields.forEach(field => {
    if (!(field in m)) {
      errors.push({
        path: field,
        message: `Missing required field: ${field}`,
        code: 'MISSING_FIELD'
      });
    }
  });
  
  // Check metaData structure
  if (m.metaData) {
    if (typeof m.metaData !== 'object') {
      errors.push({
        path: 'metaData',
        message: 'metaData must be an object',
        code: 'INVALID_TYPE'
      });
    } else {
      // Check required metaData fields
      const requiredMetaFields = ['name', 'publicPath', 'buildInfo', 'remoteEntry', 'globalName'];
      requiredMetaFields.forEach(field => {
        if (!(field in m.metaData!)) {
          errors.push({
            path: `metaData.${field}`,
            message: `Missing required field: metaData.${field}`,
            code: 'MISSING_FIELD'
          });
        }
      });
      
      // Check buildInfo
      if ('buildInfo' in m.metaData && typeof m.metaData.buildInfo === 'object') {
        if (!('buildVersion' in m.metaData.buildInfo)) {
          errors.push({
            path: 'metaData.buildInfo.buildVersion',
            message: 'Missing required field: metaData.buildInfo.buildVersion',
            code: 'MISSING_FIELD'
          });
        }
      }
      
      // Check remoteEntry
      if ('remoteEntry' in m.metaData && typeof m.metaData.remoteEntry === 'object') {
        const requiredRemoteEntryFields = ['name', 'path', 'type'];
        requiredRemoteEntryFields.forEach(field => {
          if (!(field in m.metaData!.remoteEntry!)) {
            errors.push({
              path: `metaData.remoteEntry.${field}`,
              message: `Missing required field: metaData.remoteEntry.${field}`,
              code: 'MISSING_FIELD'
            });
          }
        });
      }
    }
  }
  
  // Check remotes array
  if (m.remotes) {
    if (!Array.isArray(m.remotes)) {
      errors.push({
        path: 'remotes',
        message: 'remotes must be an array',
        code: 'INVALID_TYPE'
      });
    } else {
      m.remotes.forEach((remote, index) => {
        if (typeof remote !== 'object') {
          errors.push({
            path: `remotes[${index}]`,
            message: `Remote at index ${index} must be an object`,
            code: 'INVALID_TYPE'
          });
        } else {
          const requiredRemoteFields = ['federationContainerName', 'moduleName', 'alias', 'entry'];
          requiredRemoteFields.forEach(field => {
            if (!(field in remote)) {
              errors.push({
                path: `remotes[${index}].${field}`,
                message: `Missing required field: remotes[${index}].${field}`,
                code: 'MISSING_FIELD'
              });
            }
          });
        }
      });
    }
  }
  
  // Check shared array
  if (m.shared) {
    if (!Array.isArray(m.shared)) {
      errors.push({
        path: 'shared',
        message: 'shared must be an array',
        code: 'INVALID_TYPE'
      });
    } else {
      m.shared.forEach((shared, index) => {
        if (typeof shared !== 'object') {
          errors.push({
            path: `shared[${index}]`,
            message: `Shared at index ${index} must be an object`,
            code: 'INVALID_TYPE'
          });
        } else {
          const requiredSharedFields = ['id', 'name', 'version', 'assets'];
          requiredSharedFields.forEach(field => {
            if (!(field in shared)) {
              errors.push({
                path: `shared[${index}].${field}`,
                message: `Missing required field: shared[${index}].${field}`,
                code: 'MISSING_FIELD'
              });
            }
          });
          
          // Check assets
          if ('assets' in shared && typeof shared.assets === 'object') {
            validateAssets(shared.assets, `shared[${index}].assets`, errors);
          }
        }
      });
    }
  }
  
  // Check exposes array
  if (m.exposes) {
    if (!Array.isArray(m.exposes)) {
      errors.push({
        path: 'exposes',
        message: 'exposes must be an array',
        code: 'INVALID_TYPE'
      });
    } else {
      m.exposes.forEach((expose, index) => {
        if (typeof expose !== 'object') {
          errors.push({
            path: `exposes[${index}]`,
            message: `Expose at index ${index} must be an object`,
            code: 'INVALID_TYPE'
          });
        } else {
          const requiredExposeFields = ['id', 'name', 'path', 'assets'];
          requiredExposeFields.forEach(field => {
            if (!(field in expose)) {
              errors.push({
                path: `exposes[${index}].${field}`,
                message: `Missing required field: exposes[${index}].${field}`,
                code: 'MISSING_FIELD'
              });
            }
          });
          
          // Check assets
          if ('assets' in expose && typeof expose.assets === 'object') {
            validateAssets(expose.assets, `exposes[${index}].assets`, errors);
          }
        }
      });
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a Zephyr snapshot
 */
function validateZephyrSnapshot(snapshot: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (typeof snapshot !== 'object' || snapshot === null) {
    errors.push({
      path: '',
      message: 'Snapshot must be an object',
      code: 'INVALID_TYPE'
    });
    return { valid: false, errors };
  }
  
  const s = snapshot as Partial<Snapshot>;
  
  // Check required root fields
  const requiredRootFields = [
    'application_uid', 'version', 'snapshot_id', 'domain', 
    'uid', 'git', 'creator', 'createdAt', 'assets'
  ];
  requiredRootFields.forEach(field => {
    if (!(field in s)) {
      errors.push({
        path: field,
        message: `Missing required field: ${field}`,
        code: 'MISSING_FIELD'
      });
    }
  });
  
  // Check uid structure
  if (s.uid) {
    if (typeof s.uid !== 'object') {
      errors.push({
        path: 'uid',
        message: 'uid must be an object',
        code: 'INVALID_TYPE'
      });
    } else {
      const requiredUidFields = ['build', 'app_name', 'repo', 'org'];
      requiredUidFields.forEach(field => {
        if (!(field in s.uid!)) {
          errors.push({
            path: `uid.${field}`,
            message: `Missing required field: uid.${field}`,
            code: 'MISSING_FIELD'
          });
        }
      });
    }
  }
  
  // Check git structure
  if (s.git) {
    if (typeof s.git !== 'object') {
      errors.push({
        path: 'git',
        message: 'git must be an object',
        code: 'INVALID_TYPE'
      });
    } else {
      const requiredGitFields = ['branch', 'commit'];
      requiredGitFields.forEach(field => {
        if (!(field in s.git!)) {
          errors.push({
            path: `git.${field}`,
            message: `Missing required field: git.${field}`,
            code: 'MISSING_FIELD'
          });
        }
      });
    }
  }
  
  // Check creator structure
  if (s.creator) {
    if (typeof s.creator !== 'object') {
      errors.push({
        path: 'creator',
        message: 'creator must be an object',
        code: 'INVALID_TYPE'
      });
    } else {
      const requiredCreatorFields = ['name', 'email'];
      requiredCreatorFields.forEach(field => {
        if (!(field in s.creator!)) {
          errors.push({
            path: `creator.${field}`,
            message: `Missing required field: creator.${field}`,
            code: 'MISSING_FIELD'
          });
        }
      });
    }
  }
  
  // Check assets structure
  if (s.assets) {
    if (typeof s.assets !== 'object') {
      errors.push({
        path: 'assets',
        message: 'assets must be an object',
        code: 'INVALID_TYPE'
      });
    } else {
      Object.entries(s.assets).forEach(([key, asset]) => {
        if (typeof asset !== 'object') {
          errors.push({
            path: `assets.${key}`,
            message: `Asset at key ${key} must be an object`,
            code: 'INVALID_TYPE'
          });
        } else {
          const requiredAssetFields = ['path', 'extname', 'hash', 'size'];
          requiredAssetFields.forEach(field => {
            if (!(field in asset)) {
              errors.push({
                path: `assets.${key}.${field}`,
                message: `Missing required field: assets.${key}.${field}`,
                code: 'MISSING_FIELD'
              });
            }
          });
        }
      });
    }
  }
  
  // Check mfConfig if present
  if (s.mfConfig) {
    if (typeof s.mfConfig !== 'object') {
      errors.push({
        path: 'mfConfig',
        message: 'mfConfig must be an object',
        code: 'INVALID_TYPE'
      });
    } else {
      const requiredMfConfigFields = ['name', 'filename'];
      requiredMfConfigFields.forEach(field => {
        if (!(field in s.mfConfig!)) {
          errors.push({
            path: `mfConfig.${field}`,
            message: `Missing required field: mfConfig.${field}`,
            code: 'MISSING_FIELD'
          });
        }
      });
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Helper to validate assets structure
 */
function validateAssets(
  assets: unknown, 
  path: string, 
  errors: ValidationError[]
): void {
  if (typeof assets !== 'object' || assets === null) {
    errors.push({
      path,
      message: `${path} must be an object`,
      code: 'INVALID_TYPE'
    });
    return;
  }
  
  // Check js and css fields
  const requiredAssetFields = ['js', 'css'];
  requiredAssetFields.forEach(field => {
    if (!(field in (assets as any))) {
      errors.push({
        path: `${path}.${field}`,
        message: `Missing required field: ${path}.${field}`,
        code: 'MISSING_FIELD'
      });
    } else {
      validateAssetType((assets as any)[field], `${path}.${field}`, errors);
    }
  });
}

/**
 * Helper to validate asset type structure
 */
function validateAssetType(
  assetType: unknown, 
  path: string, 
  errors: ValidationError[]
): void {
  if (typeof assetType !== 'object' || assetType === null) {
    errors.push({
      path,
      message: `${path} must be an object`,
      code: 'INVALID_TYPE'
    });
    return;
  }
  
  // Check sync and async fields
  const requiredFields = ['sync', 'async'];
  requiredFields.forEach(field => {
    if (!(field in (assetType as any))) {
      errors.push({
        path: `${path}.${field}`,
        message: `Missing required field: ${path}.${field}`,
        code: 'MISSING_FIELD'
      });
    } else if (!Array.isArray((assetType as any)[field])) {
      errors.push({
        path: `${path}.${field}`,
        message: `${path}.${field} must be an array`,
        code: 'INVALID_TYPE'
      });
    }
  });
}

/**
 * Generic validation function that detects format and validates accordingly
 */
function validateManifest(manifest: unknown): ValidationResult {
  const format = detectManifestFormat(manifest);
  
  switch (format) {
    case ManifestFormat.MF2:
      return validateMF2Manifest(manifest);
    case ManifestFormat.ZEPHYR:
      return validateZephyrSnapshot(manifest);
    default:
      return {
        valid: false,
        errors: [{
          path: '',
          message: 'Unknown manifest format',
          code: 'UNKNOWN_FORMAT'
        }]
      };
  }
}

/**
 * Exports
 */
export {
  ManifestFormat,
  ValidationResult,
  ValidationError,
  detectManifestFormat,
  validateMF2Manifest,
  validateZephyrSnapshot,
  validateManifest
};