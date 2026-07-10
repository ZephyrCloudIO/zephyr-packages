import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { onIndexHtmlResolved, resolveIndexHtml } from './resolve-index-html';

describe('index HTML resolution', () => {
  afterEach(() => {
    rs.restoreAllMocks();
    rs.useRealTimers();
  });

  it('resolves the pending waiter and clears its deadline', async () => {
    rs.useFakeTimers();
    const clearTimeoutSpy = rs.spyOn(globalThis, 'clearTimeout');
    const pending = onIndexHtmlResolved();

    resolveIndexHtml('<html>ready</html>');

    await expect(pending).resolves.toBe('<html>ready</html>');
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('fails with a useful error after the bounded deadline', async () => {
    rs.useFakeTimers();
    const pending = onIndexHtmlResolved();
    const rejection = pending.catch((error: unknown) => error);

    await rs.advanceTimersByTimeAsync(60_000);

    await expect(rejection).resolves.toEqual(
      new Error('Timed out waiting for index HTML to be resolved')
    );
  });
});
