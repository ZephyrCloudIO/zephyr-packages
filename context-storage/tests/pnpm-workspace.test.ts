/**
 * PNPM Workspace Tests - Phase 2.2
 * 
 * These tests validate the parsing and processing of pnpm workspaces.
 */

import * as path from 'path';
import { 
  parsePnpmWorkspace, 
  traversePnpmWorkspacePackages, 
  resolveWorkspaceGlobs
} from '../workspace-support';
import { WorkspaceType, WorkspaceConfig, WorkspacePackage } from '../workspace-types';

// Base directory for the pnpm workspace fixture
const PNPM_FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'pnpm-workspace');
const PNPM_WORKSPACE_YAML = path.join(PNPM_FIXTURE_DIR, 'pnpm-workspace.yaml');

describe('pnpm workspace processing', () => {
  test('should parse pnpm-workspace.yaml file correctly', () => {
    const workspace = parsePnpmWorkspace(PNPM_WORKSPACE_YAML);
    
    expect(workspace).toBeDefined();
    expect(workspace.type).toBe(WorkspaceType.PNPM);
    expect(workspace.root).toBe(path.dirname(PNPM_WORKSPACE_YAML));
    expect(workspace.patterns).toBeInstanceOf(Array);
    expect(workspace.patterns).toContain('packages/*');
    expect(workspace.patterns).toContain('apps/*');
    expect(workspace.excludes).toBeInstanceOf(Array);
    expect(workspace.excludes).toContain('packages/private*');
    expect(workspace.excludes).toContain('**/_*');
  });
  
  test('should handle missing pnpm-workspace.yaml file', () => {
    expect(() => parsePnpmWorkspace('/non-existent-path')).toThrow();
  });
  
  test('should resolve glob patterns in workspace config', () => {
    const workspace: WorkspaceConfig = {
      type: WorkspaceType.PNPM,
      root: PNPM_FIXTURE_DIR,
      patterns: ['packages/*', 'apps/*'],
      excludes: ['packages/private*']
    };
    
    const packagePaths = resolveWorkspaceGlobs(workspace);
    
    expect(packagePaths).toBeInstanceOf(Array);
    expect(packagePaths.length).toBeGreaterThan(0);
    expect(packagePaths).toContain(path.join(PNPM_FIXTURE_DIR, 'packages/package-a'));
    expect(packagePaths).toContain(path.join(PNPM_FIXTURE_DIR, 'packages/package-b'));
    expect(packagePaths).toContain(path.join(PNPM_FIXTURE_DIR, 'apps/app-a'));
    expect(packagePaths).not.toContain(path.join(PNPM_FIXTURE_DIR, 'packages/private-pkg'));
  });
  
  test('should traverse workspace packages correctly', () => {
    const packages = traversePnpmWorkspacePackages(PNPM_FIXTURE_DIR);
    
    expect(packages).toBeInstanceOf(Array);
    expect(packages.length).toBe(3); // Excluding private package
    
    // Verify each package has the correct shape
    packages.forEach(pkg => {
      expect(pkg).toHaveProperty('name');
      expect(pkg).toHaveProperty('path');
      expect(pkg).toHaveProperty('version');
      expect(pkg.version).toBe('1.0.0');
    });
    
    // Check for specific packages
    const packageA = packages.find(p => p.name === 'package-a');
    expect(packageA).toBeDefined();
    expect(packageA.dependencies).toHaveProperty('package-b');
    expect(packageA.dependencies['package-b']).toBe('^1.0.0');
    
    const packageB = packages.find(p => p.name === 'package-b');
    expect(packageB).toBeDefined();
    expect(packageB.dependencies).toHaveProperty('react');
    expect(packageB.dependencies).toHaveProperty('react-dom');
    
    const appA = packages.find(p => p.name === 'app-a');
    expect(appA).toBeDefined();
    expect(appA.dependencies).toHaveProperty('package-a');
    expect(appA.dependencies).toHaveProperty('package-b');
  });
  
  test('should handle private packages according to options', () => {
    // First, exclude private packages (default)
    const packagesDefault = traversePnpmWorkspacePackages(PNPM_FIXTURE_DIR);
    expect(packagesDefault.find(p => p.name === 'private-pkg')).toBeUndefined();
    
    // Then, include private packages
    const packagesWithPrivate = traversePnpmWorkspacePackages(PNPM_FIXTURE_DIR, { includePrivate: true });
    const privatePackage = packagesWithPrivate.find(p => p.name === 'private-pkg');
    expect(privatePackage).toBeDefined();
    expect(privatePackage.private).toBe(true);
  });
  
  test('should properly handle exclude patterns', () => {
    const workspace: WorkspaceConfig = {
      type: WorkspaceType.PNPM,
      root: PNPM_FIXTURE_DIR,
      patterns: ['**/*'],
      excludes: ['**/*.md', '**/*.txt']
    };
    
    // There shouldn't be any .md or .txt files in the resolved paths
    const packagePaths = resolveWorkspaceGlobs(workspace);
    packagePaths.forEach(path => {
      expect(path).not.toMatch(/\.md$/);
      expect(path).not.toMatch(/\.txt$/);
    });
  });
});