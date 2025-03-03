/**
 * Workspace Integration Tests - Phase 2.2
 * 
 * These tests validate the integration of workspace support with URL encoding.
 */

import path from 'path';
import { 
  traverseWorkspacePackages,
  resolveWorkspacePackage
} from '../workspace-support';
import { encodePackageName, decodePackageName } from '../url-encoding';
import { generateRemoteUrl } from '../remote-resolution';
import { WorkspaceType } from '../workspace-types';

// Base directory for the test fixtures
const PNPM_FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'pnpm-workspace');
const YARN_FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'yarn-workspace');

describe('workspace and URL encoding integration', () => {
  test('should encode workspace package names properly', async () => {
    // Get packages from both workspace types
    const pnpmPackages = await traverseWorkspacePackages(PNPM_FIXTURE_DIR, { type: WorkspaceType.PNPM });
    const yarnPackages = await traverseWorkspacePackages(YARN_FIXTURE_DIR, { type: WorkspaceType.YARN });
    
    // Check all packages from both workspaces
    const allPackages = [...pnpmPackages, ...yarnPackages];
    
    allPackages.forEach(pkg => {
      const encodedName = encodePackageName(pkg.name);
      expect(decodePackageName(encodedName)).toEqual(pkg.name);
    });
    
    // Verify scoped package specifically
    const scopedPackage = yarnPackages.find(p => p.name === '@scoped/package');
    expect(scopedPackage).toBeDefined();
    
    const encodedScopedName = encodePackageName(scopedPackage.name);
    expect(encodedScopedName).not.toEqual(scopedPackage.name); // Should be encoded
    expect(encodedScopedName).toContain('%40'); // @ should be encoded
    expect(decodePackageName(encodedScopedName)).toEqual(scopedPackage.name);
  });
  
  test('should resolve encoded package names in workspace context', async () => {
    // Get packages from yarn workspace (includes scoped package)
    const yarnPackages = await traverseWorkspacePackages(YARN_FIXTURE_DIR, { type: WorkspaceType.YARN });
    
    // Find the scoped package
    const scopedPackage = yarnPackages.find(p => p.name === '@scoped/package');
    expect(scopedPackage).toBeDefined();
    
    // Encode the package name
    const encodedName = encodePackageName(scopedPackage.name);
    
    // Resolve using the encoded name
    const resolved = resolveWorkspacePackage(encodedName, yarnPackages);
    expect(resolved).toBeDefined();
    expect(resolved.name).toEqual(scopedPackage.name);
    expect(resolved.version).toEqual(scopedPackage.version);
    expect(resolved.path).toEqual(scopedPackage.path);
  });
  
  test('should generate correct URLs for workspace packages', async () => {
    // Get packages from both workspace types
    const pnpmPackages = await traverseWorkspacePackages(PNPM_FIXTURE_DIR, { type: WorkspaceType.PNPM });
    
    // Pick a package to test
    const pkg = pnpmPackages[0];
    const encodedName = encodePackageName(pkg.name);
    
    // Generate URL for the package
    const url = generateRemoteUrl(encodedName, pkg.version);
    
    // Verify the URL
    expect(url).toContain(encodedName);
    expect(url).toContain(pkg.version);
    expect(url).not.toContain(' '); // No spaces in URL
    
    // URL should use encoded name, not original
    if (pkg.name !== encodedName) {
      expect(url).not.toContain(pkg.name);
    }
  });
  
  test('should handle special characters in package names', async () => {
    // Create a test package with special characters
    const specialPackage = {
      name: 'package+with:special@chars',
      version: '1.0.0',
      path: '/path/to/special',
      dependencies: {}
    };
    
    // Encode the package name
    const encodedName = encodePackageName(specialPackage.name);
    expect(encodedName).not.toEqual(specialPackage.name);
    
    // Special characters should be encoded
    expect(encodedName).not.toContain('+');
    expect(encodedName).not.toContain(':');
    expect(encodedName).not.toContain('@');
    
    // Generate URL for the package
    const url = generateRemoteUrl(encodedName, specialPackage.version);
    
    // URL should be valid (no unencoded special characters from package name)
    expect(url).not.toContain('+');
    
    // The URL contains the @ symbol for separating package name and version
    // This is expected behavior, but the @ from the package name should be encoded
    expect(url).toContain('@'); // The @ separator should be present
    
    // Make sure we can decode the package name part correctly
    const packagePart = url.split('@')[0].split('/').pop();
    expect(decodePackageName(packagePart)).toBe(specialPackage.name);
  });
});