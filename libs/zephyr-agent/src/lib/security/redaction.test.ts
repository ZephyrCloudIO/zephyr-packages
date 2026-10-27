import { describe, expect, it } from '@rstest/core';
import {
  REDACTED,
  redactString,
  redactUrl,
  safeStringifyForLogging,
  sanitizeForLogging,
} from './redaction';

const secrets = {
  credential: 'AKIA-RAW-CREDENTIAL',
  signature: 'raw-amz-signature',
  securityToken: 'raw-security-token',
  token: 'raw-access-token',
  code: 'raw-oauth-code',
  state: 'raw-oauth-state',
  session: 'raw-session-id',
  secret: 'raw-client-secret',
};

function expectSecretsAbsent(value: unknown): void {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of Object.values(secrets)) {
    expect(serialized).not.toContain(secret);
  }
}

describe('logging redaction', () => {
  it('retains URL origin, path, and query names without query values or fragments', () => {
    const input = new URL('https://uploads.example.com/assets/main.js');
    input.username = 'raw-user';
    input.password = 'raw-password';
    input.searchParams.set('X-Amz-Credential', secrets.credential);
    input.searchParams.set('X-Amz-Signature', secrets.signature);
    input.searchParams.set('X-Amz-Security-Token', secrets.securityToken);
    input.searchParams.set('state', secrets.state);
    input.hash = secrets.session;
    const original = input.toString();

    const result = redactUrl(input);

    expect(input.toString()).toBe(original);
    expect(result).toContain('uploads.example.com/assets/main.js');
    expect(result).toContain('X-Amz-Credential=');
    expect(result).toContain('X-Amz-Signature=');
    expect(result).toContain('X-Amz-Security-Token=');
    expect(result).toContain(encodeURIComponent(REDACTED));
    expect(result).not.toContain('raw-user');
    expect(result).not.toContain('raw-password');
    expectSecretsAbsent(result);
  });

  it('redacts embedded URLs, bearer/JWT values, and secret assignments', () => {
    const value = [
      `PUT https://uploads.example.com/file?X-Amz-Signature=${secrets.signature}`,
      `Authorization: Bearer ${secrets.token}`,
      `code=${secrets.code}`,
      `state: ${secrets.state}`,
      `session ${secrets.session}`,
      `client_secret=${secrets.secret}`,
      `Cookie: sid=${secrets.session}; opaque=${secrets.token}`,
      'jwt: eyJhbGciOiJIUzI1NiJ9.c2VjcmV0.c2lnbmF0dXJl',
    ].join('\n');

    const result = redactString(value);

    expect(result).toContain('https://uploads.example.com/file?X-Amz-Signature=');
    expect(result).toContain(REDACTED);
    expectSecretsAbsent(result);
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('sanitizes nested errors, headers, and circular values without throwing', () => {
    const error = new Error(
      `request failed https://api.example.com/callback?code=${secrets.code}`
    ) as Error & { cause?: unknown; self?: unknown };
    error.cause = {
      headers: { Authorization: `Bearer ${secrets.token}` },
      sessionId: secrets.session,
      clientSecret: secrets.secret,
      status: 503,
      code: 'ECONNRESET',
    };
    error.self = error;

    const sanitized = sanitizeForLogging(error) as Record<string, unknown>;
    const serialized = safeStringifyForLogging(error);

    expect(sanitized['self']).toBe('[Circular]');
    expect(serialized).toContain('503');
    expect(serialized).toContain('ECONNRESET');
    expectSecretsAbsent(serialized);
  });

  it('preserves diagnostic error codes while redacting authorization codes', () => {
    const result = redactString(
      `Error code: ZE01001; cause code ECONNRESET; oauthCode=${secrets.code}`
    );

    expect(result).toContain('code: ZE01001');
    expect(result).toContain('code ECONNRESET');
    expect(result).not.toContain(secrets.code);
  });
  it('keeps HTTP status codes readable', () => {
    const result = redactString(
      'HTTP request for GET https://api.example.com/x failed with status code 503.'
    );

    expect(result).toContain('status code 503.');
    expect(result).not.toContain(REDACTED);
    expect(redactString('response code=404 and code: 502')).toBe(
      'response code=404 and code: 502'
    );
    expect(sanitizeForLogging({ code: 503, status: 503 })).toEqual({
      code: 503,
      status: 503,
    });
  });

  it('still redacts opaque codes that are not HTTP statuses', () => {
    expect(redactString(`authorization code ${secrets.code}`)).not.toContain(
      secrets.code
    );
    expect(redactString('code 123456')).toBe(`code ${REDACTED}`);
    expect(sanitizeForLogging({ code: 123456 })).toEqual({ code: REDACTED });
  });

  it('is idempotent: redacting again never changes or grows the result', () => {
    const inputs = [
      'HTTP request failed with status code 503.',
      `Authorization: Bearer ${secrets.token}`,
      `Bearer ${secrets.token}, then token ${secrets.token}.`,
      `token=${secrets.token}; secret: ${secrets.secret}`,
      `session ${secrets.session} and state ${secrets.state}`,
      `code=${secrets.code} oauthCode=${secrets.code}`,
      `Cookie: sid=${secrets.session}; opaque=${secrets.token}`,
      `GET https://uploads.example.com/file?X-Amz-Signature=${secrets.signature}#frag`,
      'Token found in environment. Using secret token for authentication.',
      '{"token":"abc","code":"x1y2z3","nested":{"password":"hunter2"}}',
      'jwt: eyJhbGciOiJIUzI1NiJ9.c2VjcmV0.c2lnbmF0dXJl',
    ];

    for (const input of inputs) {
      const once = redactString(input);
      expect(redactString(once)).toBe(once);
      expect(redactString(redactString(once))).toBe(once);
      expect(once).not.toContain(`${REDACTED}]`);
    }
  });

  it('does not leave a stray bracket when a marker is redacted again', () => {
    const once = redactString('Token found in environment');
    expect(redactString(once)).toBe(once);
    expect(redactString('token [REDACTED]')).toBe('token [REDACTED]');
    expect(redactString('password=[REDACTED]')).toBe('password=[REDACTED]');
    expect(redactString('Bearer [REDACTED]')).toBe('Bearer [REDACTED]');
  });
});
