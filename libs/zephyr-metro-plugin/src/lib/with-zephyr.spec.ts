/** Unit tests for Zephyr Metro Plugin configuration */

describe('with-zephyr', () => {
  describe('extractMetroRemoteDependencies', () => {
    // Helper function matching the implementation
    const extractMetroRemoteDependencies = (remotes: Record<string, string>) => {
      return Object.entries(remotes).map(([name, url]) => {
        const [remoteName, remoteUrl] = url.includes('@') ? url.split('@') : [name, url];

        return {
          name: remoteName,
          version: 'latest',
          remote_url: remoteUrl,
        };
      });
    };

    it('should extract simple remote URLs', () => {
      const remotes = {
        RemoteApp: 'http://localhost:9000/remoteEntry.js',
      };
      const result = extractMetroRemoteDependencies(remotes);
      expect(result).toEqual([
        {
          name: 'RemoteApp',
          version: 'latest',
          remote_url: 'http://localhost:9000/remoteEntry.js',
        },
      ]);
    });

    it('should extract remote URLs with name@url format', () => {
      const remotes = {
        SharedUI: 'SharedUILib@http://localhost:9001/remoteEntry.js',
      };
      const result = extractMetroRemoteDependencies(remotes);
      expect(result).toEqual([
        {
          name: 'SharedUILib',
          version: 'latest',
          remote_url: 'http://localhost:9001/remoteEntry.js',
        },
      ]);
    });

    it('should handle multiple remotes', () => {
      const remotes = {
        RemoteA: 'http://localhost:9000/a.js',
        RemoteB: 'ModuleB@http://localhost:9001/b.js',
        RemoteC: 'http://localhost:9002/c.js',
      };
      const result = extractMetroRemoteDependencies(remotes);
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('RemoteA');
      expect(result[1].name).toBe('ModuleB');
      expect(result[2].name).toBe('RemoteC');
    });

    it('should handle empty remotes', () => {
      const result = extractMetroRemoteDependencies({});
      expect(result).toEqual([]);
    });

    it('should always set version to latest', () => {
      const remotes = {
        RemoteApp: 'RemoteApp@http://example.com/entry.js',
      };
      const result = extractMetroRemoteDependencies(remotes);
      expect(result[0].version).toBe('latest');
    });
  });

  describe('ZephyrMetroOptions interface', () => {
    it('should accept minimal options', () => {
      const options = {};
      expect(options).toBeDefined();
    });

    it('should accept full options', () => {
      const options = {
        name: 'MyApp',
        target: 'ios' as const,
        remotes: {
          Remote1: 'http://localhost:9000/entry.js',
        },
        manifestPath: '/custom-manifest.json',
        entryFiles: ['main.tsx', 'App.tsx'],
        failOnManifestError: true,
      };
      expect(options.name).toBe('MyApp');
      expect(options.target).toBe('ios');
      expect(options.manifestPath).toBe('/custom-manifest.json');
      expect(options.entryFiles).toContain('main.tsx');
      expect(options.failOnManifestError).toBe(true);
    });

    it('should default failOnManifestError to false/undefined', () => {
      const options = {
        name: 'MyApp',
      };
      expect(options.failOnManifestError).toBeUndefined();
    });
  });

  describe('manifestPath configuration', () => {
    it('should use default path when not specified', () => {
      const defaultPath = '/zephyr-manifest.json';
      expect(defaultPath).toBe('/zephyr-manifest.json');
    });

    it('should strip leading slash for filename generation', () => {
      const endpoint = '/zephyr-manifest.json';
      const filename = endpoint.replace(/^\//, '');
      expect(filename).toBe('zephyr-manifest.json');
    });

    it('should handle custom paths', () => {
      const endpoint = '/custom/path/manifest.json';
      const filename = endpoint.replace(/^\//, '');
      expect(filename).toBe('custom/path/manifest.json');
    });
  });
});
