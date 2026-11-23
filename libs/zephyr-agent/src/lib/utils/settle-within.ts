/** How long a build waits for its last log events before it moves on. */
export const DEFAULT_LOG_FLUSH_TIMEOUT_MS = 2_000;

/** Waits for `promises`, for at most `timeoutMs`. Never rejects. */
export async function settleWithin(
  promises: readonly Promise<unknown>[],
  timeoutMs: number
): Promise<void> {
  if (promises.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, Math.max(0, timeoutMs));
    // Waiting for logs must never be the only thing keeping the process alive.
    timer.unref?.();
  });
  try {
    await Promise.race([Promise.allSettled(promises), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
