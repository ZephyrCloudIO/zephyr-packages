// The host side: how the Zephyr MCP (or a test) calls a provider worker.
import type { CallToolResult } from '../types';
import {
  CALL_TOOL_URL,
  PROTOCOL_HEADER,
  PROTOCOL_VERSION,
  type ProviderCallContext,
} from './protocol';
import { isObject } from '../object';

/**
 * Anything with a `fetch`: a Worker Loader entrypoint, a service binding, a worker
 * object.
 */
export interface ProviderFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface ProviderCallRequest {
  name: string;
  arguments?: Record<string, unknown>;
  context?: ProviderCallContext;
  /** Cancels the call; the isolate aborts the handler. */
  signal?: AbortSignal;
  /**
   * Largest response body accepted, in bytes. Defaults to 4 MiB, the Zephyr MCP's cap; a
   * larger body is cancelled and throws.
   */
  maxResponseBytes?: number;
}

/** The default response body cap: 4 MiB. */
export const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

/**
 * The provider answered outside the protocol: an unknown tool (`code` -32602, a JSON-RPC
 * invalid-params error MCP servers pass through), a protocol mismatch, or a malformed
 * response.
 */
export class ProviderCallError extends Error {
  /** The HTTP status, when there was a response. */
  readonly status?: number;
  /** -32602 for an unknown tool. */
  readonly code?: number;
  /**
   * The provider's own `error` text, kept out of `message` because the provider controls
   * it: check it before logging or showing it.
   */
  readonly providerError?: string;

  constructor(
    message: string,
    options: { status?: number; code?: number; providerError?: string } = {}
  ) {
    super(message);
    this.name = 'ProviderCallError';
    this.status = options.status;
    this.code = options.code;
    this.providerError = options.providerError;
  }
}

const isCallToolResult = (value: unknown): value is CallToolResult =>
  isObject(value) &&
  Array.isArray(value['content']) &&
  value['content'].every(isObject) &&
  (value['structuredContent'] === undefined || isObject(value['structuredContent'])) &&
  (value['isError'] === undefined || typeof value['isError'] === 'boolean');

const errorOf = (body: unknown) =>
  isObject(body) && typeof body['error'] === 'string' ? body['error'] : undefined;

// Reads the body with a byte counter, so a hostile provider cannot stream an
// unbounded answer into the host.
const readCapped = async (response: Response, maxBytes: number): Promise<string> => {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new ProviderCallError(
      `The provider's answer is over the ${maxBytes}-byte limit`,
      { status: response.status }
    );
  }
  if (!response.body) return '';
  // Typed loosely by some runtimes' declarations; a body is always bytes.
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ProviderCallError(
        `The provider's answer is over the ${maxBytes}-byte limit`,
        { status: response.status }
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
};

/**
 * Call a tool in a provider worker with a fresh request that carries only the protocol
 * headers and body. Tool failures come back as `isError` results; anything outside the
 * protocol, or an answer over `maxResponseBytes` (4 MiB), throws a
 * {@link ProviderCallError}.
 *
 * @example
 *   ```ts
 *   const worker = env.LOADER.get(isolateId, loadWorkerCode).getEntrypoint();
 *   const result = await callProviderWorker(worker, {
 *     name: 'quote_price',
 *     arguments: { sku: 'SKU-42', quantity: 3 },
 *     context: { client: { name: 'claude-code' }, deadlineMs: 30_000 },
 *   });
 *   ```;
 */
export async function callProviderWorker(
  fetcher: ProviderFetcher,
  request: ProviderCallRequest
): Promise<CallToolResult> {
  const response = await fetcher.fetch(
    new Request(CALL_TOOL_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [PROTOCOL_HEADER]: PROTOCOL_VERSION,
      },
      body: JSON.stringify({
        name: request.name,
        arguments: request.arguments ?? {},
        ...(request.context && { context: request.context }),
      }),
      signal: request.signal,
    })
  );
  const status = response.status;
  if (response.headers.get(PROTOCOL_HEADER) !== PROTOCOL_VERSION) {
    throw new ProviderCallError(
      `The provider answered ${status} without "${PROTOCOL_HEADER}: ${PROTOCOL_VERSION}"`,
      { status }
    );
  }
  const text = await readCapped(response, request.maxResponseBytes ?? MAX_RESPONSE_BYTES);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ProviderCallError(`The provider answered ${status} without JSON`, {
      status,
    });
  }
  const providerError = errorOf(body);
  if (status === 404) {
    throw new ProviderCallError(`Unknown tool: ${request.name}`, {
      status,
      code: -32602,
      ...(providerError !== undefined && { providerError }),
    });
  }
  if (status !== 200) {
    throw new ProviderCallError(`The provider answered ${status}`, {
      status,
      ...(providerError !== undefined && { providerError }),
    });
  }
  if (!isCallToolResult(body)) {
    throw new ProviderCallError('The provider answered with an invalid tool result', {
      status,
    });
  }
  return body;
}
