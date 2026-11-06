import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { getApplicationHashList } from './get-application-hash-list';

const mocks = rs.hoisted(() => ({
  getApplicationConfiguration: rs.fn(),
  makeRequest: rs.fn(),
}));

rs.mock('./get-application-configuration', () => ({
  getApplicationConfiguration: mocks.getApplicationConfiguration,
}));
rs.mock('../http/http-request', () => ({ makeRequest: mocks.makeRequest }));

describe('getApplicationHashList', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.makeRequest.mockResolvedValue([true, null, { hashes: ['h1'] }]);
  });

  it('resolves edge url and jwt from the application config', async () => {
    mocks.getApplicationConfiguration.mockResolvedValue({
      EDGE_URL: 'https://edge.example.com',
      jwt: 'cfg-jwt',
    });

    const result = await getApplicationHashList({ application_uid: 'app.project.org' });

    expect(result).toEqual({ hashes: ['h1'] });
    expect(mocks.getApplicationConfiguration).toHaveBeenCalledTimes(1);
    const [url, options] = mocks.makeRequest.mock.calls[0];
    expect(url.origin).toBe('https://edge.example.com');
    expect(url.pathname).toBe('/__get_application_hash_list__');
    expect(url.searchParams.get('application_uid')).toBe('app.project.org');
    expect(options).toEqual({ method: 'GET', headers: { can_write_jwt: 'cfg-jwt' } });
  });

  it('uses the given edge url and jwt without loading config', async () => {
    await getApplicationHashList({
      application_uid: 'app.project.org',
      edge_url: 'https://given.example.com',
      jwt: 'given-jwt',
    });

    expect(mocks.getApplicationConfiguration).not.toHaveBeenCalled();
    const [url, options] = mocks.makeRequest.mock.calls[0];
    expect(url.origin).toBe('https://given.example.com');
    expect(options).toEqual({ method: 'GET', headers: { can_write_jwt: 'given-jwt' } });
  });
});
