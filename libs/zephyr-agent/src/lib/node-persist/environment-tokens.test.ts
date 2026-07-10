import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';

import { getCiToken, hasCiToken } from './ci-token';
import { getServerToken, hasServerToken } from './server-token';

describe('environment auth tokens', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['ZE_CI_TOKEN'];
    delete process.env['ZE_SERVER_TOKEN'];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('keeps CI token detection separate from server token detection', () => {
    process.env['ZE_CI_TOKEN'] = 'ci-token';

    expect(getCiToken()).toBe('ci-token');
    expect(hasCiToken()).toBe(true);
    expect(getServerToken()).toBeUndefined();
    expect(hasServerToken()).toBe(false);
  });

  it('detects server tokens without implying a CI token', () => {
    process.env['ZE_SERVER_TOKEN'] = 'server-token';

    expect(getServerToken()).toBe('server-token');
    expect(hasServerToken()).toBe(true);
    expect(getCiToken()).toBeUndefined();
    expect(hasCiToken()).toBe(false);
  });
});
