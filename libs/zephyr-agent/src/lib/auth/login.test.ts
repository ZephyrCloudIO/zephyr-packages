import type { Mock } from '@rstest/core';

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { describe, expect, rs, it, beforeEach } from '@rstest/core';
import {
  createPrivateAuthenticationArtifact,
  formatAuthenticationPromptForTerminal,
  isTokenStillValid,
} from './login';
import * as jose from 'jose';

// Mock dependencies
rs.mock('jose', { spy: true });

describe('auth/login', () => {
  // Mock implementation
  const mockDecodeJwt = jose.decodeJwt as Mock<typeof jose.decodeJwt>;

  beforeEach(() => {
    rs.resetAllMocks();
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

  it('preserves the one-time URL only in the dedicated interactive prompt', () => {
    const authUrl =
      'https://auth.example.com/authorize?state=copyable-one-time-state&code=copyable-code';

    const prompt = formatAuthenticationPromptForTerminal(authUrl, true);

    expect(prompt).toContain(authUrl);
    expect(prompt).toContain('shown only in this terminal');
    expect(formatAuthenticationPromptForTerminal(authUrl, false)).not.toContain(
      'copyable-one-time-state'
    );
  });

  it('creates a mode-0600 fallback and removes its credential-bearing directory', () => {
    const authUrl = 'https://auth.example.com/authorize?state=private-artifact-state';
    const artifact = createPrivateAuthenticationArtifact(authUrl);
    const directory = dirname(artifact.filePath);

    try {
      expect(statSync(artifact.filePath).mode & 0o777).toBe(0o600);
      expect(statSync(directory).mode & 0o777).toBe(0o700);
      expect(readFileSync(artifact.filePath, 'utf8')).toContain('private-artifact-state');
    } finally {
      artifact.cleanup();
    }

    expect(existsSync(artifact.filePath)).toBe(false);
    expect(existsSync(directory)).toBe(false);
  });

  it('removes a partially written fallback when artifact creation fails', () => {
    const authUrl =
      'https://auth.example.com/authorize?state=private-partial-artifact-state';
    const existingDirectories = new Set(
      readdirSync(tmpdir()).filter((entry) => entry.startsWith('zephyr-auth-'))
    );
    const writeError = new Error('simulated artifact write failure');

    expect(() =>
      createPrivateAuthenticationArtifact(authUrl, (...args) => {
        writeFileSync(...args);
        throw writeError;
      })
    ).toThrow(writeError);

    const remainingDirectories = readdirSync(tmpdir()).filter(
      (entry) => entry.startsWith('zephyr-auth-') && !existingDirectories.has(entry)
    );
    expect(remainingDirectories).toEqual([]);
  });
});
