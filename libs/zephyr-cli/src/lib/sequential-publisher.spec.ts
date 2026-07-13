import { describe, expect, it, rs } from '@rstest/core';
import { SequentialPublisher } from './sequential-publisher';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe('SequentialPublisher', () => {
  it('coalesces changes during an upload into exactly one follow-up publication', async () => {
    const first = deferred();
    const second = deferred();
    const publish = rs
      .fn()
      .mockResolvedValueOnce(first.promise)
      .mockResolvedValueOnce(second.promise);
    const publisher = new SequentialPublisher(publish);

    const firstRequest = publisher.request();
    expect(publish).toHaveBeenCalledTimes(1);

    const duplicateRequest = publisher.request();
    const finalRequest = publisher.request();
    expect(duplicateRequest).toBe(firstRequest);
    expect(finalRequest).toBe(firstRequest);

    first.resolve();
    await Promise.resolve();
    expect(publish).toHaveBeenCalledTimes(2);

    second.resolve();
    await firstRequest;
    await publisher.waitForIdle();
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('allows a new publication after the prior one completes', async () => {
    const publish = rs.fn(async () => undefined);
    const publisher = new SequentialPublisher(publish);

    await publisher.request();
    await publisher.request();

    expect(publish).toHaveBeenCalledTimes(2);
  });
});
