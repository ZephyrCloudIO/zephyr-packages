/**
 * Yarn Workspace Tests - Phase 2.2
 * 
 * These tests validate the parsing and processing of yarn workspaces.
 */

import path from 'path';
import { 
  parseYarnWorkspace, 
  traverseYarnWorkspacePackages, 
  resolveYarnWorkspaceProtocol 
} from '../workspace-support';
import { WorkspaceType, WorkspaceConfig, WorkspacePackage } from '../workspace-types';

// Base directory for the yarn workspace fixture
const YARN_FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'yarn-workspace');
const YARN_PACKAGE_JSON = path.join(YARN_FIXTURE_DIR, 'package.json');

describe('yarn workspace processing', () => {
  test('should parse package.json workspaces field correctly', () => {
    const workspace = parseYarnWorkspace(YARN_PACKAGE_JSON);
    
    expect(workspace).toBeDefined();
    expect(workspace.type).toBe(WorkspaceType.YARN);
    expect(workspace.root).toBe(path.dirname(YARN_PACKAGE_JSON));
    expect(workspace.patterns).toBeInstanceOf(Array);
    expect(workspace.patterns).toContain('packages/*');
    expect(workspace.overrides).toBeDefined();
    expect(workspace.overrides.react).toBe('18.2.0');
  });
  
  test('should handle missing package.json file', () => {
    expect(() => parseYarnWorkspace('/non-existent-path')).toThrow();
  });
  
  test('should handle array workspaces format', () => {
    // Mock a package.json with array format
    const mockPackageJson = {
      workspaces: ['packages/*', 'apps/*']
    };
    
    // Parse the mock package.json
    const result = parseYarnWorkspace(YARN_PACKAGE_JSON, mockPackageJson);
    
    expect(result.patterns).toContain('packages/*');
    expect(result.patterns).toContain('apps/*');
  });
  
  test('should handle object workspaces format', () => {
    // Mock a package.json with object format
    const mockPackageJson = {
      workspaces: {
        packages: ['packages/*', 'apps/*'],
        nohoist: ['**/react', '**/react-dom']
      }
    };
    
    // Parse the mock package.json
    const result = parseYarnWorkspace(YARN_PACKAGE_JSON, mockPackageJson);
    
    expect(result.patterns).toContain('packages/*');
    expect(result.patterns).toContain('apps/*');
    expect(result.excludes).toContain('**/react');
    expect(result.excludes).toContain('**/react-dom');
  });
  
  test('should handle workspace protocol references', () => {
    const workspacePackages: WorkspacePackage[] = [
      {
        name: 'package-d',
        version: '1.0.0',
        path: path.join(YARN_FIXTURE_DIR, 'packages/package-d')
      },
      {
        name: '@scoped/package',
        version: '1.0.0',
        path: path.join(YARN_FIXTURE_DIR, 'packages/@scoped/package')
      }
    ];
    
    // Test with caret range
    const resolvedD = resolveYarnWorkspaceProtocol('workspace:^1.0.0', 'package-d', workspacePackages);
    expect(resolvedD).toBeDefined();
    expect(resolvedD.name).toBe('package-d');
    expect(resolvedD.version).toBe('1.0.0');
    expect(resolvedD.fromWorkspace).toBe(true);
    
    // Test with wildcard
    const resolvedScoped = resolveYarnWorkspaceProtocol('workspace:*', '@scoped/package', workspacePackages);
    expect(resolvedScoped).toBeDefined();
    expect(resolvedScoped.name).toBe('@scoped/package');
    expect(resolvedScoped.fromWorkspace).toBe(true);
  });
  
  test('should throw for non-existent workspace package', () => {
    const workspacePackages: WorkspacePackage[] = [];
    
    expect(() => resolveYarnWorkspaceProtocol('workspace:^1.0.0', 'non-existent', workspacePackages))
      .toThrow();
  });
  
  test('should traverse yarn workspace packages', () => {
    const packages = traverseYarnWorkspacePackages(YARN_FIXTURE_DIR);
    
    expect(packages).toBeInstanceOf(Array);
    expect(packages.length).toBe(3);
    
    // Verify each package has the correct shape
    packages.forEach(pkg => {
      expect(pkg).toHaveProperty('name');
      expect(pkg).toHaveProperty('path');
      expect(pkg).toHaveProperty('version');
      expect(pkg.version).toBe('1.0.0');
    });
    
    // Check for specific packages
    const packageC = packages.find(p => p.name === 'package-c');
    expect(packageC).toBeDefined();
    expect(packageC.dependencies).toHaveProperty('package-d');
    expect(packageC.dependencies['package-d']).toBe('workspace:^1.0.0');
    expect(packageC.dependencies).toHaveProperty('@scoped/package');
    
    const packageD = packages.find(p => p.name === 'package-d');
    expect(packageD).toBeDefined();
    expect(packageD.dependencies).toHaveProperty('react');
    expect(packageD.dependencies).toHaveProperty('react-dom');
    
    const scopedPackage = packages.find(p => p.name === '@scoped/package');
    expect(scopedPackage).toBeDefined();
    expect(scopedPackage.dependencies).toHaveProperty('lodash');
  });
  
  test('should handle scoped packages correctly', () => {
    const packages = traverseYarnWorkspacePackages(YARN_FIXTURE_DIR);
    
    // Check that the scoped package was found
    const scopedPackage = packages.find(p => p.name === '@scoped/package');
    expect(scopedPackage).toBeDefined();
    expect(scopedPackage.version).toBe('1.0.0');
    
    // Check that a package references the scoped package
    const packageC = packages.find(p => p.name === 'package-c');
    expect(packageC.dependencies).toHaveProperty('@scoped/package');
  });
});