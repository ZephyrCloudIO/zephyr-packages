/**
 * Scoped Packages Tests - Phase 2.1
 * 
 * These tests specifically validate handling of scoped packages (@org/package).
 * Following TDD principles, these tests are written before the implementation.
 */

// Import the functions we'll implement later
import { encodePackageName, decodePackageName } from '../url-encoding';

describe('Scoped Package Handling', () => {
  test('should encode scoped packages correctly', () => {
    expect(encodePackageName('@org/package')).toBe('%40org/package');
    expect(encodePackageName('@user/lib')).toBe('%40user/lib');
  });
  
  test('should handle nested scopes', () => {
    expect(encodePackageName('@org/scope/package')).toBe('%40org/scope/package');
    expect(encodePackageName('@org/scope/nested/path')).toBe('%40org/scope/nested/path');
  });
  
  test('should preserve scope structure while encoding special chars', () => {
    expect(encodePackageName('@org+plus/package:colon')).toBe('%40org%2Bplus/package%3Acolon');
    expect(encodePackageName('@org:colon/package+plus')).toBe('%40org%3Acolon/package%2Bplus');
  });
  
  test('should decode scoped packages correctly', () => {
    expect(decodePackageName('%40org/package')).toBe('@org/package');
    expect(decodePackageName('%40user/lib')).toBe('@user/lib');
  });

  test('should handle multiple @ symbols', () => {
    const packageName = '@scope/package@version';
    const encoded = encodePackageName(packageName);
    expect(encoded).toBe('%40scope/package%40version');
    expect(decodePackageName(encoded)).toBe(packageName);
  });

  test('should handle scoped packages with multiple special chars', () => {
    const packageNames = [
      '@scope/package+with:special@chars',
      '@complex/path/with+special:chars',
      '@scope/package#hash?query'
    ];

    packageNames.forEach(name => {
      const encoded = encodePackageName(name);
      // First character should be %40 (encoded @)
      expect(encoded.startsWith('%40')).toBe(true);
      // Should preserve / after scope
      expect(encoded.indexOf('/')).not.toBe(-1);
      // Special chars should be encoded
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain(':');
      expect(encoded).not.toContain('#');
      expect(encoded).not.toContain('?');
      
      // Roundtrip should preserve original name
      expect(decodePackageName(encoded)).toBe(name);
    });
  });
});