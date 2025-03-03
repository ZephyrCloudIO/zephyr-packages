/**
 * Cross-Workspace Resolution Tests - Phase 2.2
 * 
 * These tests validate the resolution of dependencies across workspace packages.
 */

import path from 'path';
import { 
  resolveWorkspaceDependency,
  detectVersionConflicts,
  resolveWithOverrides
} from '../workspace-support';
import { WorkspacePackage, VersionConflict } from '../workspace-types';

// Base directory for the complex workspace fixture
const COMPLEX_FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'complex-workspace');

describe('cross-workspace resolution', () => {
  // Define test workspace packages
  const testPackages: WorkspacePackage[] = [
    {
      name: 'package-a',
      version: '1.0.0',
      path: '/path/to/package-a',
      dependencies: { 'package-b': '^1.0.0' }
    },
    {
      name: 'package-b',
      version: '1.0.0',
      path: '/path/to/package-b',
      dependencies: {}
    },
    {
      name: 'package-c',
      version: '1.0.0',
      path: '/path/to/package-c',
      dependencies: { 'shared': '^1.0.0' }
    },
    {
      name: 'package-d',
      version: '1.0.0',
      path: '/path/to/package-d',
      dependencies: { 'shared': '^2.0.0' }
    },
    {
      name: 'shared',
      version: '1.0.0',
      path: '/path/to/shared',
      dependencies: {}
    }
  ];
  
  test('should resolve workspace dependencies correctly', () => {
    const resolved = resolveWorkspaceDependency('package-b', 'package-a', testPackages);
    
    expect(resolved).toBeDefined();
    expect(resolved.name).toBe('package-b');
    expect(resolved.version).toBe('1.0.0');
    expect(resolved.path).toBe('/path/to/package-b');
    expect(resolved.fromWorkspace).toBe(true);
  });
  
  test('should throw for non-existent dependency', () => {
    expect(() => resolveWorkspaceDependency('non-existent', 'package-a', testPackages))
      .toThrow();
  });
  
  test('should detect version conflicts in workspace', () => {
    const conflicts = detectVersionConflicts(testPackages);
    
    expect(conflicts).toBeInstanceOf(Array);
    expect(conflicts.length).toBe(1);
    
    const sharedConflict = conflicts.find(c => c.package === 'shared');
    expect(sharedConflict).toBeDefined();
    expect(sharedConflict.versions.length).toBe(2);
    
    // Check that the versions are tracked correctly
    const v1 = sharedConflict.versions.find(v => v.version === '^1.0.0');
    const v2 = sharedConflict.versions.find(v => v.version === '^2.0.0');
    
    expect(v1).toBeDefined();
    expect(v2).toBeDefined();
    
    expect(v1.requiredBy).toContain('package-c');
    expect(v2.requiredBy).toContain('package-d');
  });
  
  test('should apply override mechanism for conflicts', () => {
    const overrides = { 'shared': '2.0.0' };
    
    const resolvedPackages = resolveWithOverrides(testPackages, overrides);
    
    expect(resolvedPackages).toBeInstanceOf(Array);
    
    // Check that package-c now uses shared@2.0.0
    const resolvedPackageC = resolvedPackages.find(p => p.name === 'package-c');
    expect(resolvedPackageC.resolvedDependencies.shared).toBe('2.0.0');
    
    // Check that package-d still uses shared@2.0.0
    const resolvedPackageD = resolvedPackages.find(p => p.name === 'package-d');
    expect(resolvedPackageD.resolvedDependencies.shared).toBe('2.0.0');
  });
  
  test('should respect semver ranges when resolving', () => {
    // Add a package with a specific version range
    const packagesWithRange = [
      ...testPackages,
      {
        name: 'package-e',
        version: '1.0.0',
        path: '/path/to/package-e',
        dependencies: { 'package-b': '>=1.0.0 <2.0.0' }
      }
    ];
    
    const resolved = resolveWorkspaceDependency('package-b', 'package-e', packagesWithRange);
    
    expect(resolved).toBeDefined();
    expect(resolved.name).toBe('package-b');
    expect(resolved.version).toBe('1.0.0');
    expect(resolved.fromWorkspace).toBe(true);
  });
  
  test('should handle circular dependencies gracefully', () => {
    // Create packages with circular dependencies
    const circularPackages: WorkspacePackage[] = [
      {
        name: 'circular-a',
        version: '1.0.0',
        path: '/path/to/circular-a',
        dependencies: { 'circular-b': '^1.0.0' }
      },
      {
        name: 'circular-b',
        version: '1.0.0',
        path: '/path/to/circular-b',
        dependencies: { 'circular-a': '^1.0.0' }
      }
    ];
    
    // Should not enter an infinite loop
    const conflicts = detectVersionConflicts(circularPackages);
    expect(conflicts).toBeInstanceOf(Array);
    expect(conflicts.length).toBe(0); // No version conflicts, just circular deps
    
    // Resolution should work for direct dependencies
    const resolved = resolveWorkspaceDependency('circular-b', 'circular-a', circularPackages);
    expect(resolved).toBeDefined();
    expect(resolved.name).toBe('circular-b');
  });
});