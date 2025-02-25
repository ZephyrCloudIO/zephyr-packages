import { describe, expect, jest, it, beforeEach } from '@jest/globals';
import { isTokenStillValid } from './login';
import * as jose from 'jose';

// Mock dependencies
jest.mock('jose');

describe('auth/login', () => {
  // Mock implementation
  const mockDecodeJwt = jose.decodeJwt as jest.MockedFunction<typeof jose.decodeJwt>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('isTokenStillValid', () => {
    it('should return true for valid token with future expiration', () => {
      const token = 'valid-token';
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour in the future

      mockDecodeJwt.mockReturnValue({ exp: futureTime });

      expect(isTokenStillValid(token)).toBe(true);
    });

    it('should return false for token with past expiration', () => {
      const token = 'expired-token';
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour in the past

      mockDecodeJwt.mockReturnValue({ exp: pastTime });

      expect(isTokenStillValid(token)).toBe(false);
    });

    it('should consider the gap parameter', () => {
      const token = 'about-to-expire-token';
      const soonTime = Math.floor(Date.now() / 1000) + 30; // 30 seconds in the future

      mockDecodeJwt.mockReturnValue({ exp: soonTime });

      // With default gap (0)
      expect(isTokenStillValid(token)).toBe(true);

      // With 60 second gap
      expect(isTokenStillValid(token, 60)).toBe(false);
    });

    it('should return false for tokens without exp claim', () => {
      mockDecodeJwt.mockReturnValue({});

      expect(isTokenStillValid('token-without-exp')).toBe(false);
    });

    it('should return false if token cannot be decoded', () => {
      mockDecodeJwt.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(isTokenStillValid('invalid-token')).toBe(false);
    });
  });
});