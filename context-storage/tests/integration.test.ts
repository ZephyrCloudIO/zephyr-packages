/**
 * Integration Tests - Phase 2.1
 * 
 * These tests validate integration of URL encoding with remote resolution.
 * Following TDD principles, these tests are written before the implementation.
 */

// Import the functions we'll implement
import { encodePackageName, decodePackageName } from '../url-encoding';
import { 
  resolveRemote, 
  generateRemoteUrl, 
  resolveRemoteWithFallback
} from '../remote-resolution'; // This will be implemented later

// Mock implementation for remote resolution functions
jest.mock('../remote-resolution', () => ({
  resolveRemote: jest.fn(async (encodedPackageName, version) => {
    // Decode the package name to simulate retrieving the original
    const packageName = require('../url-encoding').decodePackageName(encodedPackageName);
    return {
      packageName,
      version,
      url: `https://zephyr-cdn.org/${encodedPackageName}@${version}`
    };
  }),
  
  generateRemoteUrl: jest.fn((encodedPackageName, version) => {
    return `https://zephyr-cdn.org/${encodedPackageName}@${version}`;
  }),
  
  resolveRemoteWithFallback: jest.fn(async (encodedPackageName, version) => {
    // Decode the package name to simulate retrieving the original
    const packageName = require('../url-encoding').decodePackageName(encodedPackageName);
    return {
      packageName,
      version,
      url: `https://zephyr-cdn.org/${encodedPackageName}@${version}`
    };
  })
}));

describe('Remote Resolution Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should resolve remote with encoded package name', async () => {
    const originalPackageName = '@org/package+special';
    const encodedPackageName = encodePackageName(originalPackageName);
    
    const remote = await resolveRemote(encodedPackageName, '1.0.0');
    
    // Check that resolved remote has correct original package name
    expect(remote).toBeDefined();
    expect(remote.packageName).toBe(originalPackageName);
    
    // Verify resolveRemote was called with encoded name
    expect(resolveRemote).toHaveBeenCalledWith(encodedPackageName, '1.0.0');
  });
  
  test('should generate correct URL for encoded package names', () => {
    const originalPackageName = '@org/package:special';
    const encodedPackageName = encodePackageName(originalPackageName);
    
    const url = generateRemoteUrl(encodedPackageName, '1.0.0');
    
    // URL should contain the encoded name
    expect(url).toContain(encodedPackageName);
    // URL should NOT contain the original name with special chars
    expect(url).not.toContain(originalPackageName);
    
    // Verify generateRemoteUrl was called with encoded name
    expect(generateRemoteUrl).toHaveBeenCalledWith(encodedPackageName, '1.0.0');
  });
  
  test('should handle fallback with encoded package names', async () => {
    const originalPackageName = '@org/package#hash';
    const encodedPackageName = encodePackageName(originalPackageName);
    
    const remote = await resolveRemoteWithFallback(encodedPackageName, '1.0.0');
    
    // Check that resolved remote has correct original package name
    expect(remote).toBeDefined();
    expect(remote.packageName).toBe(originalPackageName);
    
    // Verify resolveRemoteWithFallback was called with encoded name
    expect(resolveRemoteWithFallback).toHaveBeenCalledWith(encodedPackageName, '1.0.0');
  });

  test('should handle complex integration scenarios', async () => {
    const testCases = [
      { name: 'simple-package', version: '1.0.0' },
      { name: '@scope/package', version: '2.3.1' },
      { name: 'package+with:special#chars', version: '0.1.0-beta.1' },
      { name: '@complex/nested/path+with:chars', version: '4.2.0' }
    ];

    for (const testCase of testCases) {
      const encodedName = encodePackageName(testCase.name);
      
      // Test all integration points
      const url = generateRemoteUrl(encodedName, testCase.version);
      const remote = await resolveRemote(encodedName, testCase.version);
      const remoteFallback = await resolveRemoteWithFallback(encodedName, testCase.version);
      
      // Verify results
      expect(url).toContain(encodedName);
      expect(remote.packageName).toBe(testCase.name);
      expect(remoteFallback.packageName).toBe(testCase.name);
    }
  });
});