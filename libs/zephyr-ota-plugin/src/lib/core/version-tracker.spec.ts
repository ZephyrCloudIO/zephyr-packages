import {
  hasVersionUpdate,
  createRemoteVersionInfo,
  createStoredVersionInfo,
  getRemotesWithUpdates,
} from './version-tracker';
import type {
  StoredVersionInfo,
  ZephyrResolveResponse,
  RemoteVersionInfo,
} from '../types';

describe('hasVersionUpdate', () => {
  const baseResolved: ZephyrResolveResponse = {
    name: 'MFTextEditor',
    version: 'snapshot-v2',
    application_uid: 'mftexteditor.myproject.myorg',
    default_url: 'https://cdn.example.com',
    remote_entry_url: 'https://cdn.example.com/remote.js',
    published_at: 1700000000000,
  };

  it('should return false when no stored version (first launch)', () => {
    expect(hasVersionUpdate(null, baseResolved)).toBe(false);
  });

  it('should return false when stored version is empty', () => {
    const stored: StoredVersionInfo = {
      version: '',
      url: 'https://cdn.example.com/remote.js',
      lastUpdated: Date.now(),
    };

    expect(hasVersionUpdate(stored, baseResolved)).toBe(false);
  });

  it('should return false when versions match', () => {
    const stored: StoredVersionInfo = {
      version: 'snapshot-v2',
      url: 'https://cdn.example.com/remote.js',
      lastUpdated: Date.now(),
      publishedAt: 1700000000000,
    };

    expect(hasVersionUpdate(stored, baseResolved)).toBe(false);
  });

  it('should return true when version differs', () => {
    const stored: StoredVersionInfo = {
      version: 'snapshot-v1',
      url: 'https://cdn.example.com/remote.js',
      lastUpdated: Date.now(),
    };

    expect(hasVersionUpdate(stored, baseResolved)).toBe(true);
  });

  it('should return true when published_at differs', () => {
    const stored: StoredVersionInfo = {
      version: 'snapshot-v2',
      url: 'https://cdn.example.com/remote.js',
      lastUpdated: Date.now(),
      publishedAt: 1600000000000, // Different timestamp
    };

    expect(hasVersionUpdate(stored, baseResolved)).toBe(true);
  });

  it('should ignore published_at when not both present', () => {
    const stored: StoredVersionInfo = {
      version: 'snapshot-v2',
      url: 'https://cdn.example.com/remote.js',
      lastUpdated: Date.now(),
      // No publishedAt
    };

    const resolvedWithoutPublishedAt = { ...baseResolved, published_at: undefined };

    expect(hasVersionUpdate(stored, resolvedWithoutPublishedAt)).toBe(false);
  });
});

describe('createRemoteVersionInfo', () => {
  const resolved: ZephyrResolveResponse = {
    name: 'MFTextEditor',
    version: 'snapshot-v2',
    application_uid: 'mftexteditor.myproject.myorg',
    default_url: 'https://cdn.example.com',
    remote_entry_url: 'https://cdn.example.com/remote.js',
    published_at: 1700000000000,
  };

  it('should create info with update when version differs', () => {
    const stored: StoredVersionInfo = {
      version: 'snapshot-v1',
      url: 'https://cdn.example.com/remote.js',
      lastUpdated: Date.now(),
    };

    const result = createRemoteVersionInfo('MFTextEditor', stored, resolved);

    expect(result).toEqual({
      name: 'MFTextEditor',
      currentVersion: 'snapshot-v1',
      latestVersion: 'snapshot-v2',
      remoteEntryUrl: 'https://cdn.example.com/remote.js',
      hasUpdate: true,
      publishedAt: 1700000000000,
    });
  });

  it('should create info without update when versions match', () => {
    const stored: StoredVersionInfo = {
      version: 'snapshot-v2',
      url: 'https://cdn.example.com/remote.js',
      lastUpdated: Date.now(),
      publishedAt: 1700000000000,
    };

    const result = createRemoteVersionInfo('MFTextEditor', stored, resolved);

    expect(result.hasUpdate).toBe(false);
    expect(result.currentVersion).toBe('snapshot-v2');
    expect(result.latestVersion).toBe('snapshot-v2');
  });

  it('should handle null stored version (first launch)', () => {
    const result = createRemoteVersionInfo('MFTextEditor', null, resolved);

    expect(result.currentVersion).toBeNull();
    expect(result.latestVersion).toBe('snapshot-v2');
    expect(result.hasUpdate).toBe(false);
  });

  it('should use remote_entry_url as fallback when version is missing', () => {
    const resolvedWithoutVersion = { ...resolved, version: undefined };

    const result = createRemoteVersionInfo('MFTextEditor', null, resolvedWithoutVersion);

    expect(result.latestVersion).toBe('https://cdn.example.com/remote.js');
  });
});

describe('createStoredVersionInfo', () => {
  it('should create stored info from resolved data', () => {
    const resolved: ZephyrResolveResponse = {
      name: 'MFTextEditor',
      version: 'snapshot-v2',
      application_uid: 'mftexteditor.myproject.myorg',
      default_url: 'https://cdn.example.com',
      remote_entry_url: 'https://cdn.example.com/remote.js',
      published_at: 1700000000000,
    };

    const result = createStoredVersionInfo(resolved);

    expect(result.version).toBe('snapshot-v2');
    expect(result.url).toBe('https://cdn.example.com/remote.js');
    expect(result.publishedAt).toBe(1700000000000);
    expect(typeof result.lastUpdated).toBe('number');
  });

  it('should use remote_entry_url as version fallback', () => {
    const resolved: ZephyrResolveResponse = {
      name: 'MFTextEditor',
      application_uid: 'mftexteditor.myproject.myorg',
      default_url: 'https://cdn.example.com',
      remote_entry_url: 'https://cdn.example.com/remote.js',
    };

    const result = createStoredVersionInfo(resolved);

    expect(result.version).toBe('https://cdn.example.com/remote.js');
  });
});

describe('getRemotesWithUpdates', () => {
  it('should filter remotes with updates', () => {
    const remotes: RemoteVersionInfo[] = [
      {
        name: 'Remote1',
        currentVersion: 'v1',
        latestVersion: 'v2',
        remoteEntryUrl: 'https://cdn.example.com/remote1.js',
        hasUpdate: true,
      },
      {
        name: 'Remote2',
        currentVersion: 'v1',
        latestVersion: 'v1',
        remoteEntryUrl: 'https://cdn.example.com/remote2.js',
        hasUpdate: false,
      },
      {
        name: 'Remote3',
        currentVersion: 'v3',
        latestVersion: 'v4',
        remoteEntryUrl: 'https://cdn.example.com/remote3.js',
        hasUpdate: true,
      },
    ];

    const result = getRemotesWithUpdates(remotes);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Remote1');
    expect(result[1].name).toBe('Remote3');
  });

  it('should return empty array when no updates', () => {
    const remotes: RemoteVersionInfo[] = [
      {
        name: 'Remote1',
        currentVersion: 'v1',
        latestVersion: 'v1',
        remoteEntryUrl: 'https://cdn.example.com/remote1.js',
        hasUpdate: false,
      },
    ];

    const result = getRemotesWithUpdates(remotes);

    expect(result).toHaveLength(0);
  });

  it('should return empty array for empty input', () => {
    expect(getRemotesWithUpdates([])).toHaveLength(0);
  });
});
