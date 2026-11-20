import { describe, expect, it } from '@rstest/core';

import { getToken as publicGetToken } from '../../index';
import { getToken } from './token';

describe('public getToken export', () => {
  // Post-build consumers (zephyr-preview-environment-action) resolve the access token a
  // build exchanged from ZE_CI_TOKEN. The cache key is private, so this export is the
  // only supported way to reuse it.
  it('exposes the same token resolver builds use', () => {
    expect(publicGetToken).toBe(getToken);
  });
});
