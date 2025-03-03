/**
 * Performance Tests - Phase 2.1
 * 
 * These tests validate the performance of encoding/decoding operations.
 * Following TDD principles, these tests are written before the implementation.
 */

import { encodePackageName, decodePackageName } from '../url-encoding';

describe('Encoding/Decoding Performance', () => {
  // Performance thresholds can be adjusted based on the environment
  const PERF_THRESHOLD_MS = 50; // 50 milliseconds for 1000 operations
  
  test('should encode large number of package names efficiently', () => {
    // Create an array of 1000 package names with special characters
    const packageNames = Array(1000).fill(0).map((_, i) => 
      `package-${i}@org/with:special+chars`
    );
    
    const startTime = performance.now();
    packageNames.forEach(name => encodePackageName(name));
    const endTime = performance.now();
    
    // Should process 1000 package names in under the threshold
    expect(endTime - startTime).toBeLessThan(PERF_THRESHOLD_MS);
  });
  
  test('should decode large number of package names efficiently', () => {
    // Create an array of 1000 encoded package names
    const packageNames = Array(1000).fill(0).map((_, i) => 
      `package-${i}%40org/with%3Aspecial%2Bchars`
    );
    
    const startTime = performance.now();
    packageNames.forEach(name => decodePackageName(name));
    const endTime = performance.now();
    
    // Should process 1000 package names in under the threshold
    expect(endTime - startTime).toBeLessThan(PERF_THRESHOLD_MS);
  });
  
  test('should handle roundtrip encoding/decoding efficiently', () => {
    // Create an array of 500 package names with special characters
    const packageNames = Array(500).fill(0).map((_, i) => 
      `complex-${i}@org/path/with:special+chars?and#more${i}`
    );
    
    const startTime = performance.now();
    packageNames.forEach(name => {
      const encoded = encodePackageName(name);
      const decoded = decodePackageName(encoded);
      expect(decoded).toBe(name); // Also verify correctness
    });
    const endTime = performance.now();
    
    // Should process 500 roundtrip operations in under the threshold
    expect(endTime - startTime).toBeLessThan(PERF_THRESHOLD_MS);
  });
});

describe('Edge Cases and Stress Testing', () => {
  test('should handle extremely long package names', () => {
    // Create an extremely long package name (1000 characters)
    const longName = 'a'.repeat(1000);
    const encoded = encodePackageName(longName);
    const decoded = decodePackageName(encoded);
    
    expect(decoded).toBe(longName);
    expect(encoded.length).toBe(longName.length); // Should be same length as no encoding needed
  });
  
  test('should handle package name with only special chars', () => {
    const specialCharsOnly = '@+/:?#[]!$&\'()*,;=';
    const encoded = encodePackageName(specialCharsOnly);
    
    // All special chars should be encoded
    expect(encoded).not.toBe(specialCharsOnly);
    expect(encoded.length).toBeGreaterThan(specialCharsOnly.length);
    
    // Should decode back to original
    const decoded = decodePackageName(encoded);
    expect(decoded).toBe(specialCharsOnly);
  });
  
  test('should handle already encoded package names', () => {
    const alreadyEncoded = '%40already/encoded%3Apackage';
    
    // Re-encoding should not double-encode
    const reEncoded = encodePackageName(alreadyEncoded);
    expect(reEncoded).toBe(alreadyEncoded);
    
    // Decoding twice should be safe
    const decoded = decodePackageName(alreadyEncoded);
    const reDecoded = decodePackageName(decoded);
    expect(reDecoded).toBe(decoded);
  });
  
  test('should handle consecutive special characters', () => {
    const consecutiveSpecialChars = 'package@@@with:::multiple+++special###chars';
    const encoded = encodePackageName(consecutiveSpecialChars);
    
    // All special chars should be encoded
    expect(encoded).not.toContain('@');
    expect(encoded).not.toContain(':');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('#');
    
    // Should decode back to original
    const decoded = decodePackageName(encoded);
    expect(decoded).toBe(consecutiveSpecialChars);
  });
});