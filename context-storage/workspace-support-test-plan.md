# Workspace Support Test Plan (Phase 2.2)

## Overview

This document outlines the comprehensive test plan for the Workspace Support phase. Following our successful TDD approach from Phase 2.1, we'll create tests first, then implement the functionality to make those tests pass.

## Test Categories

### 1. PNPM Workspace Tests

These tests validate the parsing and processing of pnpm workspaces:

```typescript
describe('pnpm workspace processing', () => {
  test('should parse pnpm-workspace.yaml file correctly', () => {
    const workspace = parsePnpmWorkspace('/path/to/pnpm-workspace.yaml');
    expect(workspace).toBeDefined();
    expect(workspace.packages).toBeInstanceOf(Array);
    expect(workspace.packages).toContain('packages/*');
  });

  test('should traverse workspace packages correctly', () => {
    const packages = traversePnpmWorkspacePackages('/path/to/workspace/root');
    expect(packages).toBeInstanceOf(Array);
    expect(packages.length).toBeGreaterThan(0);
    expect(packages[0]).toHaveProperty('name');
    expect(packages[0]).toHaveProperty('path');
    expect(packages[0]).toHaveProperty('version');
  });

  test('should handle glob patterns in workspace config', () => {
    const workspace = { packages: ['packages/*', '!packages/private*'] };
    const packages = resolveWorkspaceGlobs(workspace, '/path/to/workspace/root');
    expect(packages).toContain('/path/to/workspace/root/packages/public');
    expect(packages).not.toContain('/path/to/workspace/root/packages/private');
  });

  test('should extract version information from workspace packages', () => {
    const packages = traversePnpmWorkspacePackages('/path/to/workspace/root');
    expect(packages[0]).toHaveProperty('dependencies');
    expect(packages[0].dependencies).toBeInstanceOf(Object);
    expect(Object.keys(packages[0].dependencies).length).toBeGreaterThan(0);
  });

  test('should handle workspace packages with special characters in names', () => {
    const packages = traversePnpmWorkspacePackages('/path/to/workspace/root');
    const specialPackage = packages.find(p => p.name.includes('@') || p.name.includes('+'));
    expect(specialPackage).toBeDefined();
    expect(encodePackageName(specialPackage.name)).not.toEqual(specialPackage.name);
  });
});
```

### 2. Yarn Workspace Tests

These tests focus on yarn workspace processing:

```typescript
describe('yarn workspace processing', () => {
  test('should parse package.json workspaces field correctly', () => {
    const workspace = parseYarnWorkspace('/path/to/package.json');
    expect(workspace).toBeDefined();
    expect(workspace.workspaces).toBeInstanceOf(Array);
    expect(workspace.workspaces).toContain('packages/*');
  });

  test('should handle workspace protocol references', () => {
    const dependency = 'workspace:^1.0.0';
    const resolved = resolveYarnWorkspaceProtocol(dependency, {
      name: 'package-a',
      version: '1.0.0',
      path: '/path/to/package-a'
    });
    expect(resolved).toBeDefined();
    expect(resolved.name).toEqual('package-a');
    expect(resolved.version).toEqual('1.0.0');
  });

  test('should traverse yarn workspace packages', () => {
    const packages = traverseYarnWorkspacePackages('/path/to/workspace/root');
    expect(packages).toBeInstanceOf(Array);
    expect(packages.length).toBeGreaterThan(0);
    expect(packages[0]).toHaveProperty('name');
    expect(packages[0]).toHaveProperty('path');
    expect(packages[0]).toHaveProperty('version');
  });

  test('should extract dependency information from workspace packages', () => {
    const packages = traverseYarnWorkspacePackages('/path/to/workspace/root');
    expect(packages[0]).toHaveProperty('dependencies');
    expect(packages[0]).toHaveProperty('devDependencies');
    expect(packages[0]).toHaveProperty('peerDependencies');
  });

  test('should handle nohoist configurations', () => {
    const workspace = {
      workspaces: {
        packages: ['packages/*'],
        nohoist: ['**/react', '**/react-dom']
      }
    };
    const nohoistPackages = extractNohoistPackages(workspace);
    expect(nohoistPackages).toContain('**/react');
    expect(nohoistPackages).toContain('**/react-dom');
  });
});
```

### 3. Cross-Workspace Resolution Tests

These tests validate the resolution of dependencies across workspace packages:

```typescript
describe('cross-workspace resolution', () => {
  test('should resolve workspace dependencies correctly', () => {
    const packages = [
      { name: 'package-a', version: '1.0.0', dependencies: { 'package-b': '^1.0.0' } },
      { name: 'package-b', version: '1.0.0', dependencies: {} }
    ];
    
    const resolved = resolveWorkspaceDependencies('package-a', 'package-b', packages);
    expect(resolved).toBeDefined();
    expect(resolved.name).toEqual('package-b');
    expect(resolved.version).toEqual('1.0.0');
  });

  test('should detect version conflicts in workspace', () => {
    const packages = [
      { name: 'package-a', version: '1.0.0', dependencies: { 'package-c': '^1.0.0' } },
      { name: 'package-b', version: '1.0.0', dependencies: { 'package-c': '^2.0.0' } },
      { name: 'package-c', version: '1.0.0' }
    ];
    
    const conflicts = detectVersionConflicts(packages);
    expect(conflicts).toBeInstanceOf(Array);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]).toHaveProperty('package');
    expect(conflicts[0]).toHaveProperty('versions');
    expect(conflicts[0].package).toEqual('package-c');
  });

  test('should apply override mechanism for conflicts', () => {
    const packages = [
      { name: 'package-a', version: '1.0.0', dependencies: { 'package-c': '^1.0.0' } },
      { name: 'package-b', version: '1.0.0', dependencies: { 'package-c': '^2.0.0' } },
      { name: 'package-c', version: '1.0.0' }
    ];
    
    const overrides = { 'package-c': '2.0.0' };
    const resolved = resolveWithOverrides(packages, overrides);
    
    expect(resolved).toBeInstanceOf(Array);
    expect(resolved.find(p => p.name === 'package-c').resolvedVersion).toEqual('2.0.0');
  });

  test('should integrate with URL encoding for package names', () => {
    const packageName = '@scope/package+with+special:chars';
    const encodedName = encodePackageName(packageName);
    
    const packages = [
      { name: packageName, version: '1.0.0', dependencies: {} }
    ];
    
    const resolved = resolveWorkspaceDependency(encodedName, packages);
    expect(resolved).toBeDefined();
    expect(resolved.name).toEqual(packageName);
  });
});
```

### 4. Integration Tests

These tests ensure workspace support integrates properly with the URL encoding functionality:

```typescript
describe('workspace and URL encoding integration', () => {
  test('should encode workspace package names properly', () => {
    const packages = traverseWorkspacePackages('/path/to/workspace/root');
    
    packages.forEach(pkg => {
      const encodedName = encodePackageName(pkg.name);
      expect(decodePackageName(encodedName)).toEqual(pkg.name);
    });
  });

  test('should resolve encoded package names in workspace context', () => {
    const packages = traverseWorkspacePackages('/path/to/workspace/root');
    const pkg = packages.find(p => p.name.includes('@') || p.name.includes('+'));
    const encodedName = encodePackageName(pkg.name);
    
    const resolved = resolveWorkspacePackage(encodedName, packages);
    expect(resolved).toBeDefined();
    expect(resolved.name).toEqual(pkg.name);
  });

  test('should generate correct URLs for workspace packages', () => {
    const packages = traverseWorkspacePackages('/path/to/workspace/root');
    const pkg = packages[0];
    const encodedName = encodePackageName(pkg.name);
    
    const url = generateRemoteUrl(encodedName, pkg.version);
    expect(url).toContain(encodedName);
    expect(url).toContain(pkg.version);
  });
});
```

### 5. Performance Tests

These tests ensure the workspace operations perform efficiently:

```typescript
describe('workspace performance', () => {
  test('should process large workspaces efficiently', () => {
    // Create a large workspace with 100+ packages
    const largePath = '/path/to/large/workspace';
    
    const startTime = performance.now();
    const packages = traverseWorkspacePackages(largePath);
    const endTime = performance.now();
    
    // Should process large workspace in under 1 second
    expect(endTime - startTime).toBeLessThan(1000);
    expect(packages.length).toBeGreaterThan(100);
  });
  
  test('should cache workspace package resolution', () => {
    const packages = traverseWorkspacePackages('/path/to/workspace/root');
    
    // First resolution (uncached)
    const startTime1 = performance.now();
    resolveWorkspaceDependency('package-a', packages);
    const endTime1 = performance.now();
    
    // Second resolution (should be cached)
    const startTime2 = performance.now();
    resolveWorkspaceDependency('package-a', packages);
    const endTime2 = performance.now();
    
    // Cached resolution should be at least 10x faster
    expect((endTime1 - startTime1) / (endTime2 - startTime2)).toBeGreaterThan(10);
  });
});
```

## Test Fixtures

We'll create the following test fixtures:

1. **Simple PNPM Workspace**:
```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - '!packages/private*'
```

With package structure:
```
/packages/
  /package-a/
    package.json (version: 1.0.0, deps: package-b)
  /package-b/
    package.json (version: 1.0.0)
  /private-pkg/
    package.json (should be excluded)
```

2. **Yarn Workspace**:
```json
// package.json
{
  "name": "root",
  "private": true,
  "workspaces": [
    "packages/*"
  ]
}
```

With package structure:
```
/packages/
  /package-c/
    package.json (version: 1.0.0, deps: "package-d": "workspace:^1.0.0")
  /package-d/
    package.json (version: 1.0.0)
```

3. **Complex Workspace with Conflicts**:
```
/packages/
  /package-e/
    package.json (deps: shared@1.0.0)
  /package-f/
    package.json (deps: shared@2.0.0)
  /shared/
    package.json (version: 1.0.0)
```

## Test Implementation Strategy

1. **Create test file structure**:
   ```
   /src/tests/
     pnpm-workspace.test.ts
     yarn-workspace.test.ts
     cross-workspace.test.ts
     workspace-integration.test.ts
     workspace-performance.test.ts
   ```

2. **Implement test fixtures**:
   - Create mock filesystem for workspace tests
   - Set up realistic package structures
   - Include special characters in package names

3. **Run Red Phase**:
   - Run all tests and verify they fail
   - Document specific failures
   - Create stub implementation files

4. **Track Progress**:
   - Update TDD tracker with test status
   - Document test coverage metrics
   - Record implementation decisions

## Expected Results

After implementation, we expect:

1. All tests to pass successfully
2. Code coverage of at least 90% for the workspace support module
3. Performance within specified thresholds
4. Proper integration with URL encoding functionality
5. Robust handling of all edge cases

This test plan will guide our implementation of workspace support functionality, ensuring we maintain the high quality standards established in Phase 2.1.