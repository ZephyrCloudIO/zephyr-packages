/** Header every isolate request and response carries. */
export const PROTOCOL_HEADER = 'x-federated-mcp-protocol';
/** The isolate protocol version this package speaks. */
export const PROTOCOL_VERSION = '1';
/** The one URL the host calls; the host name is never resolved. */
export const CALL_TOOL_URL = 'https://provider.internal/call-tool';
export const CALL_TOOL_PATH = '/call-tool';

/**
 * Non-enumerable property of the worker holding the provider, so the Rslib preset can
 * read tool schemas from the built bundle in Node. Part of the artifact contract: keep
 * the key stable.
 */
export const PROVIDER_SYMBOL: unique symbol = Symbol.for(
  'module-federation.mcp.provider'
);

/** What the host knows about a call, passed on to the tool handler. */
export interface ProviderCallContext {
  /** The MCP client, as the host identified it. */
  client?: { name: string; version?: string; protocolVersion?: string };
  /** The user and organization calling, when the host knows them. */
  caller?: { id: string; organization?: string };
  /** Milliseconds the handler has before its signal aborts. */
  deadlineMs?: number;
}

/** The body of `POST /call-tool`. */
export interface ProviderCallBody {
  name: string;
  arguments: Record<string, unknown>;
  context?: ProviderCallContext;
}
