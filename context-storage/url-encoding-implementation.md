# URL Encoding Implementation Details

## Overview

This document outlines the implementation details of the URL encoding module for Zephyr package names. It provides insights into the design decisions, key algorithms, and future optimization opportunities.

## Core Functionality

### Package Name Encoding

The package name encoding implementation follows these key principles:

1. **Preserve scoped package structure**: Maintain the `/` character to keep scoped packages readable
2. **Encode special characters**: Ensure all problematic characters are properly encoded for URL safety
3. **Prevent double-encoding**: Detect already encoded names to avoid corrupting them
4. **Handle edge cases**: Support empty strings, long names, and special character sequences

The core algorithm for `encodePackageName`:

```typescript
export function encodePackageName(packageName: string): string {
  // Input validation
  if (packageName === null || packageName === undefined) {
    throw new Error('Package name cannot be null or undefined');
  }
  
  // Handle empty string case
  if (packageName === '') {
    return '';
  }
  
  // If it looks like it's already encoded, return as is to avoid double-encoding
  if (isLikelyEncoded(packageName)) {
    return packageName;
  }
  
  // Special handling for scoped packages while preserving structure
  if (packageName.includes('/')) {
    return packageName
      .split('/')
      .map(part => encodeURIComponent(part))
      .join('/');
  }
  
  // For regular package names, just encode directly
  return encodeURIComponent(packageName);
}
```

### Package Name Decoding

The decoding implementation follows similar principles in reverse:

1. **Preserve structure**: Maintain the package structure during decoding
2. **Handle non-encoded input**: Safely handle inputs that are not encoded
3. **Proper error handling**: Validate inputs and provide clear error messages

The core algorithm for `decodePackageName`:

```typescript
export function decodePackageName(encodedPackageName: string): string {
  // Input validation
  if (encodedPackageName === null || encodedPackageName === undefined) {
    throw new Error('Encoded package name cannot be null or undefined');
  }
  
  // Handle empty string case
  if (encodedPackageName === '') {
    return '';
  }
  
  // If it doesn't look encoded, return as is
  if (!isLikelyEncoded(encodedPackageName)) {
    return encodedPackageName;
  }
  
  // Special handling for scoped packages while preserving structure
  if (encodedPackageName.includes('/')) {
    return encodedPackageName
      .split('/')
      .map(part => decodeURIComponent(part))
      .join('/');
  }
  
  // For regular package names, just decode directly
  return decodeURIComponent(encodedPackageName);
}
```

## Key Design Decisions

### 1. Split-and-Join Approach for Path Preservation

We chose to split package names by `/` and encode each part separately to preserve the structure of scoped packages. This approach has several advantages:

- Maintains readability of scoped packages (`@angular/core` becomes `%40angular/core`)
- Preserves the semantic meaning of package paths
- Makes debugging easier as the structure is still recognizable

### 2. Already-Encoded Detection

We implemented detection for already encoded strings to prevent double-encoding:

```typescript
function isLikelyEncoded(str: string): boolean {
  // Look for percent-encoded characters (like %40, %2B, etc.)
  return /%[0-9A-Fa-f]{2}/.test(str);
}
```

This approach:
- Prevents corruption of already encoded strings
- Handles idempotent encoding operations gracefully
- Improves robustness in mixed encoding environments

### 3. Error Handling Strategy

We implemented comprehensive error handling with specific error messages:

- Null/undefined inputs are rejected with clear error messages
- Empty strings are handled as a special case
- Invalid encoded strings will throw standard decoding errors

## Integration with Remote Resolution

The URL encoding module integrates with remote resolution through three main functions:

1. **`generateRemoteUrl`**: Creates URLs with encoded package names
2. **`resolveRemote`**: Resolves remote packages using encoded names
3. **`resolveRemoteWithFallback`**: Adds fallback support for resilience

The API design ensures:
- Encoded package names are used in URLs for safety
- Original package names are preserved in the returned metadata
- Error handling is comprehensive and informative

## Performance Considerations

Current performance metrics:
- 1000 encoding operations: < 50ms
- 1000 decoding operations: < 50ms
- 500 roundtrip operations: < 50ms

## Future Optimizations

### Caching Mechanism

For frequently used package names, a caching mechanism could significantly improve performance:

```typescript
// Example cache implementation (to be added in refactor phase)
const encodeCache = new Map<string, string>();
const decodeCache = new Map<string, string>();

export function encodePackageName(packageName: string): string {
  // Check cache first
  if (encodeCache.has(packageName)) {
    return encodeCache.get(packageName)!;
  }
  
  // Existing implementation...
  const result = /* current implementation */;
  
  // Cache the result
  encodeCache.set(packageName, result);
  return result;
}
```

### Regular Expression Optimization

The current regex pattern for detecting encoded strings could be optimized:

```typescript
// More optimized regex (to be implemented in refactor phase)
const ENCODED_PATTERN = /(?:%[0-9A-Fa-f]{2})+/;
```

### Specialized Handling for Common Patterns

We could add specialized handling for common package name patterns:

```typescript
// Example specialized handling (to be added in refactor phase)
function encodeCommonPatterns(packageName: string): string | null {
  // Handle @scope/package pattern directly
  if (/^@[\w-]+\/[\w-]+$/.test(packageName)) {
    return `%40${packageName.substring(1)}`;
  }
  
  // No special pattern matched
  return null;
}
```

## Conclusion

The URL encoding implementation provides a robust solution for handling package names in URLs. It preserves the structure of scoped packages while ensuring URL safety. The implementation is well-tested with 23 test cases covering a wide range of scenarios.

---

Document created: 3/3/2025