import {
  detectRemotesFromRuntime,
  buildDependenciesConfig,
  type DetectedRemote,
} from './detect-remotes';

// Mock @module-federation/runtime
jest.mock('@module-federation/runtime', () => ({
  getInstance: jest.fn(),
}));

import { getInstance } from '@module-federation/runtime';

const mockGetInstance = getInstance as jest.MockedFunction<typeof getInstance>;

// Type for mocking the federation host
interface MockFederationHost {
  options?: {
    remotes?: Array<{
      name: string;
      entry?: string;
    }>;
  };
}

describe('detect-remotes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectRemotesFromRuntime', () => {
    it('should return empty array when no federation host exists', () => {
      mockGetInstance.mockReturnValue(null);

      const result = detectRemotesFromRuntime();

      expect(result).toEqual([]);
    });

    it('should return empty array when host has no remotes', () => {
      mockGetInstance.mockReturnValue({
        options: {},
      } as MockFederationHost as ReturnType<typeof getInstance>);

      const result = detectRemotesFromRuntime();

      expect(result).toEqual([]);
    });

    it('should return empty array when remotes array is empty', () => {
      mockGetInstance.mockReturnValue({
        options: {
          remotes: [],
        },
      } as MockFederationHost as ReturnType<typeof getInstance>);

      const result = detectRemotesFromRuntime();

      expect(result).toEqual([]);
    });

    it('should extract remotes with zephyr: protocol entries', () => {
      mockGetInstance.mockReturnValue({
        options: {
          remotes: [
            {
              name: 'MFTextEditor',
              entry: 'zephyr:mftexteditor.myproject.myorg@staging',
            },
            {
              name: 'MFNotesList',
              entry: 'zephyr:mfnoteslist.myproject.myorg@production',
            },
          ],
        },
      } as MockFederationHost as ReturnType<typeof getInstance>);

      const result = detectRemotesFromRuntime();

      expect(result).toEqual([
        {
          name: 'MFTextEditor',
          applicationUid: 'mftexteditor.myproject.myorg',
          currentEnvironment: 'staging',
        },
        {
          name: 'MFNotesList',
          applicationUid: 'mfnoteslist.myproject.myorg',
          currentEnvironment: 'production',
        },
      ]);
    });

    it('should filter out non-zephyr protocol entries', () => {
      mockGetInstance.mockReturnValue({
        options: {
          remotes: [
            {
              name: 'MFTextEditor',
              entry: 'zephyr:mftexteditor.myproject.myorg@staging',
            },
            {
              name: 'ExternalRemote',
              entry: 'https://example.com/remoteEntry.js',
            },
            {
              name: 'NoEntry',
            },
          ],
        },
      } as MockFederationHost as ReturnType<typeof getInstance>);

      const result = detectRemotesFromRuntime();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('MFTextEditor');
    });

    it('should handle invalid zephyr protocol format gracefully', () => {
      mockGetInstance.mockReturnValue({
        options: {
          remotes: [
            {
              name: 'ValidRemote',
              entry: 'zephyr:valid.project.org@env',
            },
            {
              name: 'InvalidRemote',
              entry: 'zephyr:invalid-format', // Missing @environment
            },
          ],
        },
      } as MockFederationHost as ReturnType<typeof getInstance>);

      const result = detectRemotesFromRuntime();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('ValidRemote');
    });

    it('should handle errors gracefully and return empty array', () => {
      mockGetInstance.mockImplementation(() => {
        throw new Error('Runtime error');
      });

      const result = detectRemotesFromRuntime();

      expect(result).toEqual([]);
    });
  });

  describe('buildDependenciesConfig', () => {
    const detectedRemotes: DetectedRemote[] = [
      {
        name: 'MFTextEditor',
        applicationUid: 'mftexteditor.myproject.myorg',
        currentEnvironment: 'staging',
      },
      {
        name: 'MFNotesList',
        applicationUid: 'mfnoteslist.myproject.myorg',
        currentEnvironment: 'staging',
      },
    ];

    it('should build dependencies with default environment for all remotes', () => {
      const result = buildDependenciesConfig(detectedRemotes, 'production');

      expect(result).toEqual({
        MFTextEditor: 'zephyr:mftexteditor.myproject.myorg@production',
        MFNotesList: 'zephyr:mfnoteslist.myproject.myorg@production',
      });
    });

    it('should apply per-remote environment overrides', () => {
      const result = buildDependenciesConfig(detectedRemotes, 'staging', {
        MFTextEditor: 'production',
      });

      expect(result).toEqual({
        MFTextEditor: 'zephyr:mftexteditor.myproject.myorg@production',
        MFNotesList: 'zephyr:mfnoteslist.myproject.myorg@staging',
      });
    });

    it('should apply multiple overrides', () => {
      const result = buildDependenciesConfig(detectedRemotes, 'staging', {
        MFTextEditor: 'production',
        MFNotesList: 'canary',
      });

      expect(result).toEqual({
        MFTextEditor: 'zephyr:mftexteditor.myproject.myorg@production',
        MFNotesList: 'zephyr:mfnoteslist.myproject.myorg@canary',
      });
    });

    it('should ignore overrides for non-existent remotes', () => {
      const result = buildDependenciesConfig(detectedRemotes, 'staging', {
        NonExistentRemote: 'production',
      });

      expect(result).toEqual({
        MFTextEditor: 'zephyr:mftexteditor.myproject.myorg@staging',
        MFNotesList: 'zephyr:mfnoteslist.myproject.myorg@staging',
      });
    });

    it('should return empty object for empty remotes array', () => {
      const result = buildDependenciesConfig([], 'staging');

      expect(result).toEqual({});
    });

    it('should handle undefined overrides', () => {
      const result = buildDependenciesConfig(detectedRemotes, 'staging', undefined);

      expect(result).toEqual({
        MFTextEditor: 'zephyr:mftexteditor.myproject.myorg@staging',
        MFNotesList: 'zephyr:mfnoteslist.myproject.myorg@staging',
      });
    });
  });
});
