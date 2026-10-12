// The isolate side. Bundled into every provider's tools/index.js, so it
// imports nothing but the tool runner: no zod, no YAML, no node:*.
import { errorResult, invokeTool } from '../tools';
import type { AnySkillTool, CallToolResult, SkillsProvider, ToolContext } from '../types';
import {
  CALL_TOOL_PATH,
  PROTOCOL_HEADER,
  PROTOCOL_VERSION,
  PROVIDER_SYMBOL,
  type ProviderCallBody,
  type ProviderCallContext,
} from './protocol';
import { isObject } from '../object';

/** What `createProviderWorker` returns: a Worker's default export. */
export interface ProviderWorker {
  fetch(request: Request): Promise<Response>;
  readonly [PROVIDER_SYMBOL]: SkillsProvider;
}

const MAX_TIMER_MS = 2 ** 31 - 1;

const respond = (status: number, text: string, headers: Record<string, string> = {}) =>
  new Response(text, {
    status,
    headers: {
      'content-type': 'application/json',
      [PROTOCOL_HEADER]: PROTOCOL_VERSION,
      ...headers,
    },
  });

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  respond(status, JSON.stringify(body), headers);

// A result that cannot become JSON (a BigInt, a cycle) is the tool's
// error, never a rejected fetch without the protocol header.
const resultText = (name: string, result: CallToolResult): string => {
  try {
    return JSON.stringify(result);
  } catch {
    return JSON.stringify(
      errorResult(new Error(`Tool "${name}" returned a result that is not valid JSON`))
    );
  }
};

const optionalString = (value: unknown) =>
  value === undefined || typeof value === 'string';

// Returns why the body is malformed, or the parsed body.
const parseBody = (body: unknown): ProviderCallBody | string => {
  if (!isObject(body)) return 'the body must be a JSON object';
  const { name, arguments: args = {}, context } = body;
  if (typeof name !== 'string' || name.length === 0) {
    return '"name" must be a string';
  }
  if (!isObject(args)) return '"arguments" must be an object';
  if (context === undefined) return { name, arguments: args };
  if (!isObject(context)) return '"context" must be an object';
  const { client, caller, deadlineMs } = context;
  if (
    client !== undefined &&
    !(
      isObject(client) &&
      typeof client['name'] === 'string' &&
      optionalString(client['version']) &&
      optionalString(client['protocolVersion'])
    )
  ) {
    return '"context.client" must be { name, version?, protocolVersion? }';
  }
  if (
    caller !== undefined &&
    !(
      isObject(caller) &&
      typeof caller['id'] === 'string' &&
      optionalString(caller['organization'])
    )
  ) {
    return '"context.caller" must be { id, organization? }';
  }
  if (
    deadlineMs !== undefined &&
    !(typeof deadlineMs === 'number' && Number.isFinite(deadlineMs) && deadlineMs > 0)
  ) {
    return '"context.deadlineMs" must be a positive number';
  }
  return { name, arguments: args, context };
};

const toClient = (client: ProviderCallContext['client']): ToolContext['client'] =>
  client
    ? {
        ...(client.protocolVersion !== undefined && {
          protocolVersion: client.protocolVersion,
        }),
        info: {
          name: client.name,
          ...(client.version !== undefined && { version: client.version }),
        },
      }
    : {};

/**
 * Turn a provider's tools into a Worker that runs them for the Zephyr MCP: `POST
 * /call-tool` with `x-federated-mcp-protocol: 1`. Arguments are validated with each
 * tool's real schema, `structuredContent` with its output schema, and the handler's
 * signal aborts at `deadlineMs` or when the request is cancelled. The provider stays
 * readable through `Symbol.for('module-federation.mcp.provider')`.
 *
 * The Rslib preset generates the entry that calls this; you rarely call it yourself.
 *
 * @example
 *
 * ```ts
 * export default createProviderWorker({
 *   kind: SKILLS_PROVIDER_KIND,
 *   name: 'billing',
 *   skills: [],
 *   tools: [quotePrice],
 * });
 * ```
 */
export function createProviderWorker(provider: SkillsProvider): ProviderWorker {
  const tools = new Map<string, AnySkillTool>();
  for (const tool of provider.tools) {
    if (typeof tool?.name === 'string') tools.set(tool.name, tool);
  }
  const providerInfo = {
    name: provider.name ?? 'provider',
    ...(provider.version !== undefined && { version: provider.version }),
  };

  const callTool = async (request: Request): Promise<Response> => {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json(400, { error: 'malformed body: not JSON' });
    }
    const body = parseBody(raw);
    if (typeof body === 'string') {
      return json(400, { error: `malformed body: ${body}` });
    }
    const tool = tools.get(body.name);
    if (!tool) return json(404, { error: `Unknown tool: ${body.name}` });

    const controller = new AbortController();
    const deadlineMs = body.context?.deadlineMs;
    let reason = `Tool "${body.name}" was cancelled`;
    // Timers overflow past 2^31-1 ms and would fire at once; a deadline that
    // far out is no deadline at all.
    const timer =
      deadlineMs === undefined || deadlineMs > MAX_TIMER_MS
        ? undefined
        : setTimeout(() => {
            reason = `Tool "${body.name}" timed out after ${deadlineMs} ms`;
            controller.abort(new Error(reason));
          }, deadlineMs);
    const onAbort = () => controller.abort(request.signal.reason);
    if (request.signal.aborted) onAbort();
    else request.signal.addEventListener('abort', onAbort, { once: true });

    const aborted = new Promise<CallToolResult>((resolve) => {
      const settle = () => resolve(errorResult(new Error(reason)));
      if (controller.signal.aborted) settle();
      else controller.signal.addEventListener('abort', settle, { once: true });
    });
    try {
      const result = await Promise.race([
        invokeTool(tool, body.arguments, {
          provider: providerInfo,
          signal: controller.signal,
          client: toClient(body.context?.client),
          ...(body.context?.caller && { caller: body.context.caller }),
        }),
        aborted,
      ]);
      return respond(200, resultText(body.name, result));
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener('abort', onAbort);
    }
  };

  const route = async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);
    if (pathname !== CALL_TOOL_PATH) return json(404, { error: 'not found' });
    if (request.method !== 'POST') {
      return json(405, { error: 'method not allowed' }, { allow: 'POST' });
    }
    if (request.headers.get(PROTOCOL_HEADER) !== PROTOCOL_VERSION) {
      return json(400, { error: 'unsupported protocol' });
    }
    const mediaType = (request.headers.get('content-type') ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase();
    if (mediaType !== 'application/json') {
      return json(415, { error: 'unsupported media type' });
    }
    return await callTool(request);
  };

  const worker = {
    async fetch(request: Request): Promise<Response> {
      // Every answer carries the protocol header, even an unexpected failure.
      try {
        return await route(request);
      } catch {
        return json(500, { error: 'internal error' });
      }
    },
  };
  Object.defineProperty(worker, PROVIDER_SYMBOL, {
    value: provider,
    enumerable: false,
  });
  return worker as ProviderWorker;
}
