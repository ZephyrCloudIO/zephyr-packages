/**
 * Workspace Performance Tests - Phase 2.2
 * 
 * These tests validate the performance of workspace operations.
 */

import path from 'path';
import { 
  traverseWorkspacePackages,
  resolveWorkspaceDependency,
  detectVersionConflicts
} from '../workspace-support';
import { WorkspaceType, WorkspacePackage } from '../workspace-types';

// Performance thresholds (in milliseconds)
const TRAVERSE_THRESHOLD = 1000; // 1 second for large workspace
const RESOLVE_THRESHOLD = 50;    // 50ms for bulk resolution
const CONFLICT_THRESHOLD = 500;  // 500ms for conflict detection

// Create a large test workspace
function createLargeWorkspace(size: number): WorkspacePackage[] {
  const packages: WorkspacePackage[] = [];
  
  for (let i = 0; i < size; i++) {
    const dependencies: Record<string, string> = {};
    
    // Add some dependencies to make it realistic
    // Each package depends on up to 5 previous packages
    for (let j = 0; j < 5; j++) {
      const depIndex = Math.floor(Math.random() * i);
      if (depIndex >= 0 && depIndex < i) {
        dependencies[`package-${depIndex}`] = '^1.0.0';
      }
    }
    
    packages.push({
      name: `package-${i}`,
      version: '1.0.0',
      path: `/path/to/package-${i}`,
      dependencies
    });
  }
  
  return packages;
}

describe('workspace performance', () => {
  test('should process real workspaces efficiently', async () => {
    // Get the base directory for the test fixtures
    const fixtureDir = path.resolve(__dirname, 'fixtures');
    
    // Time the processing of both workspace types
    const startTime = performance.now();
    
    // Process pnpm workspace
    const pnpmPackages = await traverseWorkspacePackages(
      path.join(fixtureDir, 'pnpm-workspace'),
      { type: WorkspaceType.PNPM }
    );
    
    // Process yarn workspace
    const yarnPackages = await traverseWorkspacePackages(
      path.join(fixtureDir, 'yarn-workspace'),
      { type: WorkspaceType.YARN }
    );
    
    // Process complex workspace
    const complexPackages = await traverseWorkspacePackages(
      path.join(fixtureDir, 'complex-workspace'),
      { type: WorkspaceType.YARN }
    );
    
    const endTime = performance.now();
    
    // Verify we processed all workspaces
    expect(pnpmPackages.length).toBeGreaterThan(0);
    expect(yarnPackages.length).toBeGreaterThan(0);
    expect(complexPackages.length).toBeGreaterThan(0);
    
    // Check performance
    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(TRAVERSE_THRESHOLD);
  });
  
  test('should handle large workspaces efficiently', () => {
    // Create a large workspace with 100 packages
    const largeWorkspace = createLargeWorkspace(100);
    
    // Time the conflict detection
    const startTime = performance.now();
    const conflicts = detectVersionConflicts(largeWorkspace);
    const endTime = performance.now();
    
    // Check performance
    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(CONFLICT_THRESHOLD);
  });
  
  test('should cache workspace package resolution', () => {
    // Create a workspace with 50 packages
    const workspace = createLargeWorkspace(50);
    
    // Pick a package with dependencies
    const packageWithDeps = workspace.find(p => 
      p.dependencies && Object.keys(p.dependencies).length > 0
    );
    
    if (!packageWithDeps) {
      throw new Error('Test workspace did not generate any packages with dependencies');
    }
    
    const dependencyName = Object.keys(packageWithDeps.dependencies)[0];
    
    // First resolution (uncached)
    const startTime1 = performance.now();
    const resolved1 = resolveWorkspaceDependency(dependencyName, packageWithDeps.name, workspace);
    const endTime1 = performance.now();
    
    // Second resolution (should be cached)
    const startTime2 = performance.now();
    const resolved2 = resolveWorkspaceDependency(dependencyName, packageWithDeps.name, workspace);
    const endTime2 = performance.now();
    
    // Verify correct resolution
    expect(resolved1).toBeDefined();
    expect(resolved2).toBeDefined();
    expect(resolved1).toEqual(resolved2);
    
    // Check performance - cached resolution should be significantly faster
    const firstTime = endTime1 - startTime1;
    const secondTime = endTime2 - startTime2;
    
    // The second call should be faster due to lookup optimization
    // In CI environments performance can vary, so we use a lower threshold
    expect(firstTime / secondTime).toBeGreaterThan(1);
  });
  
  test('should resolve multiple dependencies efficiently', () => {
    // Create a workspace with 100 packages
    const workspace = createLargeWorkspace(100);
    
    // Collect 50 dependencies to resolve
    const dependencies: Array<[string, string]> = [];
    for (let i = 0; i < 50; i++) {
      const packageIndex = Math.floor(Math.random() * workspace.length);
      const pkg = workspace[packageIndex];
      
      if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
        const depName = Object.keys(pkg.dependencies)[0];
        dependencies.push([depName, pkg.name]);
      }
    }
    
    // Ensure we have some dependencies to test
    expect(dependencies.length).toBeGreaterThan(0);
    
    // Time the bulk resolution
    const startTime = performance.now();
    
    for (const [depName, pkgName] of dependencies) {
      const resolved = resolveWorkspaceDependency(depName, pkgName, workspace);
      expect(resolved).toBeDefined();
    }
    
    const endTime = performance.now();
    
    // Check performance - should resolve all dependencies within threshold
    const totalTime = endTime - startTime;
    const timePerResolution = totalTime / dependencies.length;
    
    expect(timePerResolution).toBeLessThan(RESOLVE_THRESHOLD);
  });
});