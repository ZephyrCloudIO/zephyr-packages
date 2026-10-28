import { fetchWithRetries } from './fetch-with-retries';
import { parseUrl } from './http-request';

export type HttpProbeResult =
  | { outcome: 'response'; status: number; body: string }
  | { outcome: 'timeout' }
  | { outcome: 'network_error'; reason: string };

export interface HttpProbeOptions {
  headers?: Record<string, string>;
  /** Hard limit for the whole request, including connecting and reading the body. */
  timeoutMs: number;
}

const NETWORK_REASONS: Array<[RegExp, string]> = [
  [/ECONNREFUSED/u, 'connection refused'],
  [/ENOTFOUND|EAI_AGAIN|DNS lookup failed/u, 'DNS lookup failed'],
  [/ECONNRESET|EPIPE/u, 'connection reset'],
  [/ENETUNREACH/u, 'network unreachable'],
  [/ETIMEDOUT|ECONNABORTED/u, 'connection timed out'],
];

function describeNetworkError(error: unknown): string {
  const text = [
    error instanceof Error ? error.message : String(error),
    (error as { cause?: { code?: unknown } } | undefined)?.cause?.code,
  ].join(' ');
  return NETWORK_REASONS.find(([pattern]) => pattern.test(text))?.[1] ?? 'network error';
}

/**
 * Sends one request that never retries, never touches stored credentials and never
 * throws. A 401 from a probe must not remove the user's token, so this does not use
 * `makeRequest`. It still honors the proxy settings that builds use.
 */
export async function probeHttp(
  url: URL,
  { headers, timeoutMs }: HttpProbeOptions
): Promise<HttpProbeResult> {
  // Builds add a hint to gateway requests in preview environments; match them. A
  // malformed ZE_API_GATE makes that lookup throw, which must not stop the probe.
  let target = url;
  try {
    target = parseUrl(new URL(url));
  } catch {
    target = url;
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchWithRetries(
      target,
      { method: 'GET', headers, signal: controller.signal },
      0,
      // Our timer is the limit. A later deadline keeps axios from racing it.
      timeoutMs + 1_000
    );
    return { outcome: 'response', status: response.status, body: await response.text() };
  } catch (error) {
    return timedOut
      ? { outcome: 'timeout' }
      : { outcome: 'network_error', reason: describeNetworkError(error) };
  } finally {
    clearTimeout(timer);
  }
}
