import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  getApplicationConfiguration: rs.fn(),
  makeRequest: rs.fn(),
}));

rs.mock('./get-application-configuration', () => ({
  getApplicationConfiguration: mocks.getApplicationConfiguration,
}));
rs.mock('../http/http-request', () => ({ makeRequest: mocks.makeRequest }));

import { getApplicationHashList } from './get-application-hash-list';

describe('getApplicationHashList', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getApplicationConfiguration.mockResolvedValue({
      EDGE_URL: 'https://edge.example.test',
      jwt: 'can-write-token',
    });
    mocks.makeRequest.mockResolvedValue([true, null, { hashes: ['a'] }]);
  });

  it('sends the same can_write token header as uploads', async () => {
    await expect(
      getApplicationHashList({ application_uid: 'app.repo.org' })
    ).resolves.toEqual({ hashes: ['a'] });

    const [url, options] = mocks.makeRequest.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'https://edge.example.test/__get_application_hash_list__?application_uid=app.repo.org'
    );
    expect(options).toEqual({
      method: 'GET',
      headers: { can_write_jwt: 'can-write-token' },
    });
  });

  it('uses an environment edge with the application token', async () => {
    await getApplicationHashList({
      application_uid: 'app.repo.org',
      edge_url: 'https://env.example.test',
    });

    const [url, options] = mocks.makeRequest.mock.calls[0] as [URL, RequestInit];
    expect(url.origin).toBe('https://env.example.test');
    expect(options.headers).toEqual({ can_write_jwt: 'can-write-token' });
  });

  it('throws on a failed list so callers fall back to an empty set', async () => {
    mocks.makeRequest.mockResolvedValue([false, new Error('403')]);
    await expect(
      getApplicationHashList({ application_uid: 'app.repo.org' })
    ).rejects.toThrow();
  });
});
