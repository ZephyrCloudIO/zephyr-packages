# URL Encoding Test Plan (Phase 2.1)

## Overview

This document outlines the comprehensive test plan for the URL encoding enhancement phase. Following our TDD approach, we'll create tests first, then implement the functionality to make those tests pass.

## Test Categories

### 1. Basic Encoding/Decoding Tests

These tests validate the core encoding and decoding functionality:

```typescript
describe('package name encoder', () => {
  test('should encode plain package name without changes', () => {
    expect(encodePackageName('react')).toBe('react');
    expect(encodePackageName('lodash')).toBe('lodash');
  });

  test('should encode package name with @ prefix', () => {
    expect(encodePackageName('@angular/core')).toBe('%40angular/core');
  });

  test('should encode special characters', () => {
    expect(encodePackageName('package+with+plus')).toBe('package%2Bwith%2Bplus');
    expect(encodePackageName('package/with/slashes')).toBe('package%2Fwith%2Fslashes');
    expect(encodePackageName('package:with:colons')).toBe('package%3Awith%3Acolons');
  });

  test('should handle empty package name', () => {
    expect(encodePackageName('')).toBe('');
  });
});

describe('package name decoder', () => {
  test('should decode encoded package name', () => {
    expect(decodePackageName('%40angular/core')).toBe('@angular/core');
    expect(decodePackageName('package%2Bwith%2Bplus')).toBe('package+with+plus');
  });

  test('should handle plain package name without changes', () => {
    expect(decodePackageName('react')).toBe('react');
    expect(decodePackageName('lodash')).toBe('lodash');
  });

  test('should handle empty package name', () => {
    expect(decodePackageName('')).toBe('');
  });
});
```

### 2. Problematic Character Tests

These tests focus on characters that commonly cause issues in URLs:

```typescript
describe('problematic characters', () => {
  const problematicChars = ['@', '+', '/', ':', '%', '?', '#', '[', ']', '!', '$', '&', "'", '(', ')', '*', ',', ';', '='];
  
  test.each(problematicChars)('should properly encode and decode %s character', (char) => {
    const packageName = `package${char}name`;
    const encoded = encodePackageName(packageName);
    expect(encoded).not.toContain(char);
    expect(decodePackageName(encoded)).toBe(packageName);
  });
  
  test('should properly encode and decode package with multiple problematic chars', () => {
    const complexName = 'complex@package/with:special+chars?and#more';
    const encoded = encodePackageName(complexName);
    problematicChars.forEach(char => {
      expect(encoded).not.toContain(char);
    });
    expect(decodePackageName(encoded)).toBe(complexName);
  });
});
```

### 3. Scoped Package Tests

These tests specifically validate handling of scoped packages:

```typescript
describe('scoped packages', () => {
  test('should encode scoped packages correctly', () => {
    expect(encodePackageName('@org/package')).toBe('%40org/package');
    expect(encodePackageName('@user/lib')).toBe('%40user/lib');
  });
  
  test('should handle nested scopes', () => {
    expect(encodePackageName('@org/scope/package')).toBe('%40org/scope/package');
  });
  
  test('should preserve scope structure while encoding special chars', () => {
    expect(encodePackageName('@org+plus/package:colon')).toBe('%40org%2Bplus/package%3Acolon');
  });
  
  test('should decode scoped packages correctly', () => {
    expect(decodePackageName('%40org/package')).toBe('@org/package');
    expect(decodePackageName('%40user/lib')).toBe('@user/lib');
  });
});
```

### 4. Edge Case Tests

These tests cover edge cases and error handling:

```typescript
describe('edge cases', () => {
  test('should handle extremely long package names', () => {
    const longName = 'a'.repeat(256);
    expect(decodePackageName(encodePackageName(longName))).toBe(longName);
  });
  
  test('should handle package name with only special chars', () => {
    const specialCharsOnly = '@+/:?#[]';
    const encoded = encodePackageName(specialCharsOnly);
    expect(decodePackageName(encoded)).toBe(specialCharsOnly);
  });
  
  test('should handle already encoded package names', () => {
    const alreadyEncoded = '%40already/encoded';
    expect(encodePackageName(alreadyEncoded)).toBe(alreadyEncoded);
  });
  
  test('should handle null and undefined gracefully', () => {
    // @ts-ignore - deliberate null test
    expect(() => encodePackageName(null)).toThrow();
    // @ts-ignore - deliberate undefined test
    expect(() => encodePackageName(undefined)).toThrow();
  });
});
```

### 5. Integration Tests

These tests validate integration with the remote resolution logic:

```typescript
describe('remote resolution integration', () => {
  test('should resolve remote with encoded package name', async () => {
    const encodedPackageName = encodePackageName('@org/package+special');
    const remote = await resolveRemote(encodedPackageName, '1.0.0');
    expect(remote).toBeDefined();
    expect(remote.packageName).toBe('@org/package+special');
  });
  
  test('should generate correct URL for encoded package names', () => {
    const encodedPackageName = encodePackageName('@org/package:special');
    const url = generateRemoteUrl(encodedPackageName, '1.0.0');
    expect(url).toContain('%40org/package%3Aspecial');
    expect(url).not.toContain('@org/package:special');
  });
  
  test('should handle fallback with encoded package names', async () => {
    const encodedPackageName = encodePackageName('@org/package#hash');
    const remote = await resolveRemoteWithFallback(encodedPackageName, '1.0.0');
    expect(remote).toBeDefined();
    expect(remote.packageName).toBe('@org/package#hash');
  });
});
```

## Performance Tests

These tests ensure the encoding/decoding operations are performant:

```typescript
describe('performance', () => {
  test('should encode large number of package names efficiently', () => {
    const packageNames = Array(1000).fill(0).map((_, i) => `package-${i}@org/with:special+chars`);
    
    const startTime = performance.now();
    packageNames.forEach(name => encodePackageName(name));
    const endTime = performance.now();
    
    // Should process 1000 package names in under 50ms
    expect(endTime - startTime).toBeLessThan(50);
  });
  
  test('should decode large number of package names efficiently', () => {
    const encodedNames = Array(1000).fill(0).map((_, i) => 
      encodePackageName(`package-${i}@org/with:special+chars`)
    );
    
    const startTime = performance.now();
    encodedNames.forEach(name => decodePackageName(name));
    const endTime = performance.now();
    
    // Should process 1000 package names in under 50ms
    expect(endTime - startTime).toBeLessThan(50);
  });
});
```

## Test Implementation Strategy

1. **Create test file structure**:
   ```
   /src/tests/
     url-encoding.test.ts
     scoped-packages.test.ts
     integration.test.ts
   ```

2. **Implement test fixtures**:
   - Create mock data for package names
   - Set up test environment with Jest
   - Create mocks for remote resolution

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
2. Code coverage of at least 95% for the URL encoding module
3. Performance within specified thresholds
4. Compatibility with all package name formats
5. Proper handling of all edge cases

This test plan will guide our implementation of the URL encoding enhancement and ensure we achieve high quality through our TDD approach.