/**
 * URL Encoding Tests - Phase 2.1
 * 
 * These tests validate the encoding and decoding of package names for URL compatibility.
 * Following TDD principles, these tests are written before the implementation.
 */

// Import the functions we'll implement later
import { encodePackageName, decodePackageName } from '../url-encoding';

describe('Package Name Encoder', () => {
  // Basic encoding tests
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

  // Advanced encoding tests
  test('should handle package name with multiple special characters', () => {
    const complexName = 'complex@package/with:special+chars?and#more';
    const encodedName = encodePackageName(complexName);
    
    // Check that problematic characters are encoded
    expect(encodedName).not.toContain('@');
    expect(encodedName).not.toContain('+');
    expect(encodedName).not.toContain(':');
    expect(encodedName).not.toContain('?');
    expect(encodedName).not.toContain('#');
    
    // Ensure the encoded name can be decoded back to the original
    expect(decodePackageName(encodedName)).toBe(complexName);
  });
});

describe('Package Name Decoder', () => {
  // Basic decoding tests
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

  // Should be idempotent
  test('should be idempotent for already decoded names', () => {
    const packageName = '@angular/core';
    expect(decodePackageName(packageName)).toBe(packageName);
  });
});

describe('Roundtrip Encoding/Decoding', () => {
  test('should preserve package name through encode-decode roundtrip', () => {
    const packageNames = [
      'simple-package',
      '@scoped/package',
      'package-with-hyphens',
      'package.with.dots',
      'complex@package/with:special+chars?and#more',
      'package_with_underscores',
      '@multiple/nested/scopes'
    ];

    packageNames.forEach(name => {
      const encoded = encodePackageName(name);
      const decoded = decodePackageName(encoded);
      expect(decoded).toBe(name);
    });
  });
});

describe('Error Handling', () => {
  test('should throw on null input', () => {
    // @ts-ignore - deliberate null test
    expect(() => encodePackageName(null)).toThrow();
    // @ts-ignore - deliberate null test
    expect(() => decodePackageName(null)).toThrow();
  });

  test('should throw on undefined input', () => {
    // @ts-ignore - deliberate undefined test
    expect(() => encodePackageName(undefined)).toThrow();
    // @ts-ignore - deliberate undefined test
    expect(() => decodePackageName(undefined)).toThrow();
  });
});