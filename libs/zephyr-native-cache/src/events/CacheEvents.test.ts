import { describe, expect, it, rs } from '@rstest/core';
import { CacheEvents } from './CacheEvents';

describe('CacheEvents', () => {
  it('delivers typed events and removes handlers', () => {
    const events = new CacheEvents();
    const handler = rs.fn();

    events.on('poll:complete', handler);
    events.emitPollComplete(3, 1);
    events.off('poll:complete', handler);
    events.emitPollComplete(4, 2);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      checked: 3,
      updated: 1,
      timestamp: expect.any(Number),
    });
  });

  it('replays buffered bundle loads once', () => {
    const events = new CacheEvents();

    events.emitBundleLoad(
      'https://cdn.example.test/remote.js',
      'checkout',
      'cache-hit',
      'sha256:abc'
    );

    expect(events.drainLoadEvents()).toEqual([
      {
        bundleUrl: 'https://cdn.example.test/remote.js',
        remoteName: 'checkout',
        status: 'cache-hit',
        hash: 'sha256:abc',
        timestamp: expect.any(Number),
      },
    ]);
    expect(events.drainLoadEvents()).toEqual([]);
  });
});
