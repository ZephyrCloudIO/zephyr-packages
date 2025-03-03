/**
 * Semver Utilities and Resolver Tests
 */

import {
  parseVersion,
  compareVersions,
  satisfiesRange,
  filterSatisfyingVersions,
  findHighestSatisfyingVersion,
  findLowestSatisfyingVersion,
  areRangesCompatible,
  findCommonVersion
} from '../semver-utils';

import { SemverResolver } from '../semver-resolver';
import { EnhancedRemoteResolver } from '../enhanced-remote-resolution';

describe('Semver Utilities', () => {
  describe('parseVersion', () => {
    it('should parse valid semver versions', () => {
      expect(parseVersion('1.2.3')).toEqual({
        major: 1,
        minor: 2,
        patch: 3
      });
      
      expect(parseVersion('0.1.0-beta.1')).toEqual({
        major: 0,
        minor: 1,
        patch: 0,
        prerelease: 'beta.1'
      });
      
      expect(parseVersion('1.0.0+build.123')).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
        buildMetadata: 'build.123'
      });
      
      expect(parseVersion('2.0.0-alpha.1+build.456')).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
        prerelease: 'alpha.1',
        buildMetadata: 'build.456'
      });
    });
    
    it('should return null for invalid versions', () => {
      expect(parseVersion('invalid')).toBeNull();
      expect(parseVersion('1.0')).toBeNull();
      expect(parseVersion('1.0.0.0')).toBeNull();
      expect(parseVersion('01.1.0')).toBeNull();
    });
  });
  
  describe('compareVersions', () => {
    it('should compare major, minor, and patch versions correctly', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
      expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      
      expect(compareVersions('1.1.0', '1.2.0')).toBeLessThan(0);
      expect(compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0);
      
      expect(compareVersions('1.0.1', '1.0.2')).toBeLessThan(0);
      expect(compareVersions('1.0.2', '1.0.1')).toBeGreaterThan(0);
    });
    
    it('should compare prerelease versions correctly', () => {
      expect(compareVersions('1.0.0-alpha', '1.0.0')).toBeLessThan(0);
      expect(compareVersions('1.0.0', '1.0.0-alpha')).toBeGreaterThan(0);
      
      expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2')).toBeLessThan(0);
      expect(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.1')).toBeGreaterThan(0);
      
      expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
      expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBeGreaterThan(0);
      
      expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.1.0')).toBeLessThan(0);
    });
    
    it('should throw for invalid versions', () => {
      expect(() => compareVersions('invalid', '1.0.0')).toThrow();
      expect(() => compareVersions('1.0.0', 'invalid')).toThrow();
    });
  });
  
  describe('satisfiesRange', () => {
    it('should handle exact version matches', () => {
      expect(satisfiesRange('1.0.0', '1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.0', '2.0.0')).toBe(false);
    });
    
    it('should handle caret ranges (^)', () => {
      expect(satisfiesRange('1.0.0', '^1.0.0')).toBe(true);
      expect(satisfiesRange('1.1.0', '^1.0.0')).toBe(true);
      expect(satisfiesRange('2.0.0', '^1.0.0')).toBe(false);
      
      expect(satisfiesRange('0.1.0', '^0.1.0')).toBe(true);
      expect(satisfiesRange('0.1.1', '^0.1.0')).toBe(true);
      expect(satisfiesRange('0.2.0', '^0.1.0')).toBe(false);
    });
    
    it('should handle tilde ranges (~)', () => {
      expect(satisfiesRange('1.0.0', '~1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.1', '~1.0.0')).toBe(true);
      expect(satisfiesRange('1.1.0', '~1.0.0')).toBe(false);
    });
    
    it('should handle inequality operators', () => {
      expect(satisfiesRange('1.0.0', '>=1.0.0')).toBe(true);
      expect(satisfiesRange('0.9.0', '>=1.0.0')).toBe(false);
      
      expect(satisfiesRange('1.0.0', '>0.9.0')).toBe(true);
      expect(satisfiesRange('0.9.0', '>0.9.0')).toBe(false);
      
      expect(satisfiesRange('1.0.0', '<=1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.1', '<=1.0.0')).toBe(false);
      
      expect(satisfiesRange('0.9.0', '<1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.0', '<1.0.0')).toBe(false);
    });
    
    it('should handle range combinations', () => {
      expect(satisfiesRange('1.0.0', '>=1.0.0 <2.0.0')).toBe(true);
      expect(satisfiesRange('1.5.0', '>=1.0.0 <2.0.0')).toBe(true);
      expect(satisfiesRange('2.0.0', '>=1.0.0 <2.0.0')).toBe(false);
      expect(satisfiesRange('0.9.0', '>=1.0.0 <2.0.0')).toBe(false);
    });
  });
  
  describe('filterSatisfyingVersions', () => {
    const versions = [
      '0.1.0', '0.2.0', '1.0.0-alpha.1', '1.0.0-beta.1', 
      '1.0.0', '1.0.1', '1.1.0', '2.0.0'
    ];
    
    it('should filter versions that satisfy the range', () => {
      expect(filterSatisfyingVersions(versions, '1.0.0')).toEqual(['1.0.0']);
      expect(filterSatisfyingVersions(versions, '^1.0.0')).toEqual(['1.0.0', '1.0.1', '1.1.0']);
      expect(filterSatisfyingVersions(versions, '~1.0.0')).toEqual(['1.0.0', '1.0.1']);
      expect(filterSatisfyingVersions(versions, '>=1.0.0')).toEqual(['1.0.0', '1.0.1', '1.1.0', '2.0.0']);
    });
    
    it('should exclude prereleases by default', () => {
      expect(filterSatisfyingVersions(versions, '^1.0.0-alpha.0')).toEqual(['1.0.0', '1.0.1', '1.1.0']);
    });
    
    it('should include prereleases when specified', () => {
      expect(filterSatisfyingVersions(versions, '^1.0.0-alpha.0', true))
        .toEqual(['1.0.0-alpha.1', '1.0.0-beta.1', '1.0.0', '1.0.1', '1.1.0']);
    });
  });
  
  describe('findHighestSatisfyingVersion', () => {
    const versions = ['0.1.0', '1.0.0', '1.1.0', '1.2.0', '2.0.0'];
    
    it('should find the highest version that satisfies the range', () => {
      expect(findHighestSatisfyingVersion(versions, '^1.0.0')).toBe('1.2.0');
      expect(findHighestSatisfyingVersion(versions, '~1.0.0')).toBe('1.0.0');
      expect(findHighestSatisfyingVersion(versions, '>=1.0.0')).toBe('2.0.0');
    });
    
    it('should return null if no version satisfies the range', () => {
      expect(findHighestSatisfyingVersion(versions, '^3.0.0')).toBeNull();
    });
  });
  
  describe('findLowestSatisfyingVersion', () => {
    const versions = ['0.1.0', '1.0.0', '1.1.0', '1.2.0', '2.0.0'];
    
    it('should find the lowest version that satisfies the range', () => {
      expect(findLowestSatisfyingVersion(versions, '^1.0.0')).toBe('1.0.0');
      expect(findLowestSatisfyingVersion(versions, '>=1.1.0')).toBe('1.1.0');
      expect(findLowestSatisfyingVersion(versions, '>1.0.0')).toBe('1.1.0');
    });
    
    it('should return null if no version satisfies the range', () => {
      expect(findLowestSatisfyingVersion(versions, '^3.0.0')).toBeNull();
    });
  });
  
  describe('areRangesCompatible', () => {
    it('should determine if ranges are compatible', () => {
      expect(areRangesCompatible('^1.0.0', '^1.1.0')).toBe(true);
      expect(areRangesCompatible('^1.0.0', '^2.0.0')).toBe(false);
      expect(areRangesCompatible('~1.0.0', '~1.0.1')).toBe(false);
      expect(areRangesCompatible('>=1.0.0', '<=2.0.0')).toBe(true);
    });
  });
  
  describe('findCommonVersion', () => {
    const versions = ['0.1.0', '1.0.0', '1.1.0', '1.2.0', '2.0.0', '3.0.0'];
    
    it('should find a common version satisfying multiple ranges', () => {
      expect(findCommonVersion(['^1.0.0', '^1.1.0'], versions)).toBe('1.2.0');
      expect(findCommonVersion(['^1.0.0', '<2.0.0'], versions)).toBe('1.2.0');
      expect(findCommonVersion(['^1.0.0', '>=1.0.0 <3.0.0'], versions)).toBe('2.0.0');
    });
    
    it('should return null if no common version exists', () => {
      expect(findCommonVersion(['^1.0.0', '^2.0.0'], versions)).toBeNull();
    });
    
    it('should respect the preferHighest option', () => {
      expect(findCommonVersion(['^1.0.0', '<2.0.0'], versions, true)).toBe('1.2.0');
      expect(findCommonVersion(['^1.0.0', '<2.0.0'], versions, false)).toBe('1.0.0');
    });
  });
});

describe('SemverResolver', () => {
  let resolver: SemverResolver;
  
  beforeEach(() => {
    resolver = new SemverResolver();
  });
  
  // These tests use the mocked implementation
  describe('resolveVersion', () => {
    it('should resolve exact version requirements', async () => {
      const result = await resolver.resolveVersion('test-package', '1.0.0');
      
      expect(result.resolvedVersion).toBe('1.0.0');
      expect(result.exactMatch).toBe(true);
      expect(result.url).toContain('1.0.0');
    });
    
    it('should resolve caret ranges', async () => {
      const result = await resolver.resolveVersion('test-package', '^1.0.0');
      
      expect(result.resolvedVersion).toBe('1.3.0');
      expect(result.exactMatch).toBe(false);
    });
    
    it('should respect preferHighest option', async () => {
      const resultHigh = await resolver.resolveVersion('test-package', '^1.0.0', { preferHighest: true });
      const resultLow = await resolver.resolveVersion('test-package', '^1.0.0', { preferHighest: false });
      
      expect(resultHigh.resolvedVersion).toBe('1.3.0');
      expect(resultLow.resolvedVersion).toBe('1.0.0');
    });
    
    it('should respect includePrerelease option', async () => {
      const resultWithPre = await resolver.resolveVersion(
        'test-package', 
        '^2.0.0-alpha', 
        { includePrerelease: true }
      );
      
      expect(resultWithPre.resolvedVersion).toBe('2.0.0-beta.1');
      
      await expect(resolver.resolveVersion(
        'test-package', 
        '^2.0.0-alpha', 
        { includePrerelease: false }
      )).rejects.toThrow();
    });
    
    it('should throw if no matching versions', async () => {
      await expect(resolver.resolveVersion('test-package', '^4.0.0')).rejects.toThrow();
    });
  });
  
  describe('resolveConflictingVersions', () => {
    it('should find a common version when one exists', async () => {
      const { result, conflicts } = await resolver.resolveConflictingVersions(
        'test-package',
        ['^1.0.0', '^1.1.0']
      );
      
      expect(result.resolvedVersion).toBe('1.3.0');
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].resolved).toBe(true);
    });
    
    it('should resolve conflicts when no common version exists', async () => {
      const { result, conflicts } = await resolver.resolveConflictingVersions(
        'test-package',
        ['^1.0.0', '^2.0.0']
      );
      
      expect(result.resolvedVersion).toBe('1.3.0'); // Defaults to highest matching first range
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].resolved).toBe(true);
      expect(conflicts[0].resolutionStrategy).toBe('highest');
    });
    
    it('should follow the strategy option', async () => {
      const { result: resultLatest } = await resolver.resolveConflictingVersions(
        'test-package',
        ['^1.0.0', '^2.0.0'],
        { strategy: 'latest' }
      );
      
      expect(resultLatest.resolvedVersion).toBe('3.1.0');
      
      await expect(resolver.resolveConflictingVersions(
        'test-package',
        ['^1.0.0', '^2.0.0'],
        { strategy: 'exact' }
      )).rejects.toThrow();
    });
  });
  
  describe('resolveRemotes', () => {
    it('should resolve multiple remotes', async () => {
      const remotes = {
        'app1': { remote: 'test-package', version: '^1.0.0' },
        'app2': { remote: 'other-package', version: '2.0.0' }
      };
      
      const result = await resolver.resolveRemotes(remotes);
      
      expect(Object.keys(result).length).toBe(2);
      expect(result.app1).toContain('test-package/1.3.0');
      expect(result.app2).toContain('other-package/2.0.0');
    });
    
    it('should handle conflicting requirements for the same package', async () => {
      const remotes = {
        'app1': { remote: 'test-package', version: '^1.0.0' },
        'app2': { remote: 'test-package', version: '^1.1.0' }
      };
      
      const result = await resolver.resolveRemotes(remotes);
      
      // Both should resolve to the same URL since they're compatible
      expect(result.app1).toBe(result.app2);
      expect(result.app1).toContain('test-package/1.3.0');
    });
    
    it('should resolve incompatible requirements', async () => {
      const remotes = {
        'app1': { remote: 'test-package', version: '^1.0.0' },
        'app2': { remote: 'test-package', version: '^2.0.0' }
      };
      
      const result = await resolver.resolveRemotes(remotes);
      
      // By default, first requirement wins with highest compatible version
      expect(result.app1).toBe(result.app2);
      expect(result.app1).toContain('test-package/1.3.0');
    });
  });
});

describe('EnhancedRemoteResolver', () => {
  let resolver: EnhancedRemoteResolver;
  
  beforeEach(() => {
    resolver = new EnhancedRemoteResolver({
      registryUrl: 'https://test-registry.com'
    });
  });
  
  describe('resolveRemotes', () => {
    it('should handle string remotes', async () => {
      const remotes = {
        'app1': 'https://example.com/app1/remoteEntry.js',
        'app2': 'https://example.com/app2/remoteEntry.js'
      };
      
      const result = await resolver.resolveRemotes(remotes);
      
      expect(Object.keys(result).length).toBe(2);
      expect(result.app1).toBe('https://example.com/app1/remoteEntry.js');
      expect(result.app2).toBe('https://example.com/app2/remoteEntry.js');
    });
    
    it('should handle object remotes with version requirements', async () => {
      const remotes = {
        'app1': { remote: 'test-package', version: '^1.0.0' },
        'app2': { remote: 'other-package', version: '2.0.0' }
      };
      
      const result = await resolver.resolveRemotes(remotes);
      
      expect(Object.keys(result).length).toBe(2);
      expect(result.app1).toContain('test-package');
      expect(result.app2).toContain('other-package');
    });
    
    it('should encode URLs when specified', async () => {
      resolver = new EnhancedRemoteResolver({
        registryUrl: 'https://test-registry.com',
        encodeUrls: true
      });
      
      const remotes = {
        'app1': { remote: '@scope/package', version: '^1.0.0' }
      };
      
      const result = await resolver.resolveRemotes(remotes);
      
      // Check that the scope is encoded properly
      expect(result.app1).not.toContain('@scope/package');
    });
  });
});