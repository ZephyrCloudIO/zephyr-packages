import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@rstest/core';
import * as z from 'zod';
import { defineTool, SKILLS_PROVIDER_KIND, type AnySkillTool } from '../src';
import { toCatalogTool } from '../src/manifest';
import {
  callProviderWorker,
  CALL_TOOL_URL,
  createProviderWorker,
  PROTOCOL_HEADER,
  PROVIDER_SYMBOL,
  ProviderCallError,
  type ProviderFetcher,
} from '../src/worker';
import type { SkillsProvider } from '../src/types';

const contract = path.resolve(import.meta.dirname, 'fixtures/contract');

// What the Rslib preset's generated entry passes to createProviderWorker.
const defineProvider = (definition: {
  name?: string;
  version?: string;
  tools: AnySkillTool[];
}): SkillsProvider => ({ kind: SKILLS_PROVIDER_KIND, skills: [], ...definition });

const quotePrice = defineTool({
  name: 'quote_price',
  description: 'Price a basket.',
  inputSchema: z.object({ sku: z.string(), quantity: z.int().min(1) }),
  outputSchema: z.object({ total: z.number() }),
  annotations: { readOnlyHint: true },
  handler: ({ quantity }) => ({ total: quantity * 10, extra: 'stripped' }),
});

const provider = defineProvider({
  name: 'tools-basic',
  version: '1.0.0',
  tools: [
    quotePrice,
    defineTool({
      name: 'whoami',
      description: 'Report the context.',
      handler: (_input, { client, caller, provider: info }) => ({
        client,
        caller: caller ?? null,
        provider: info,
      }),
    }),
    defineTool({
      name: 'wait',
      description: 'Wait for the signal.',
      handler: (_input, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    }),
    defineTool({
      name: 'explode',
      description: 'Throws.',
      handler: () => {
        throw new Error('boom');
      },
    }),
    defineTool({
      name: 'no_structured',
      description: 'Declares an output schema but returns text.',
      outputSchema: z.object({ ok: z.boolean() }),
      handler: () => 'just text',
    }),
    defineTool({
      name: 'bad_structured',
      description: 'Returns the wrong structured content.',
      outputSchema: z.object({ ok: z.boolean() }),
      handler: () => ({ ok: 'yes' }),
    }),
    defineTool({
      name: 'plain_structured',
      description: 'A plain JSON Schema output is not checked field by field.',
      outputSchema: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
      },
      handler: () => ({ ok: 'yes' }),
    }),
    defineTool({
      name: 'plain_text',
      description: 'A plain JSON Schema output still needs structuredContent.',
      outputSchema: { type: 'object' },
      handler: () => 'just text',
    }),
    defineTool({
      name: 'failing_structured',
      description: 'An error result skips output validation.',
      outputSchema: z.object({ ok: z.boolean() }),
      handler: () => ({
        isError: true,
        content: [{ type: 'text', text: 'nope' }],
      }),
    }),
  ],
});

const worker = createProviderWorker(provider);
// Requests a test must keep reachable while their call is in flight.
const inFlight = new Set<Request>();

const post = (
  body: unknown,
  init: {
    headers?: Record<string, string>;
    url?: string;
    method?: string;
    signal?: AbortSignal;
  } = {}
) =>
  worker.fetch(
    new Request(init.url ?? CALL_TOOL_URL, {
      method: init.method ?? 'POST',
      headers: init.headers ?? {
        'content-type': 'application/json; charset=utf-8',
        [PROTOCOL_HEADER]: '1',
      },
      ...(init.method === 'GET' || init.method === 'HEAD'
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
      signal: init.signal,
    })
  );

const textOf = (body: Record<string, unknown>) =>
  (body['content'] as Array<{ text?: string }> | undefined)?.[0]?.text;

const statusOf = async (response: Response) => ({
  status: response.status,
  protocol: response.headers.get(PROTOCOL_HEADER),
  body: (await response.json()) as Record<string, unknown>,
});

describe('createProviderWorker', () => {
  it('exposes the provider under a non-enumerable symbol', () => {
    expect(worker[PROVIDER_SYMBOL]).toBe(provider);
    expect(Object.keys(worker)).toEqual(['fetch']);
    expect(
      (worker as unknown as Record<symbol, unknown>)[
        Symbol.for('module-federation.mcp.provider')
      ]
    ).toBe(provider);
  });

  it('answers protocol errors with the right status and the protocol header', async () => {
    const cases: Array<[string, Promise<Response>, number]> = [
      ['other path', post({}, { url: 'https://provider.internal/other' }), 404],
      ['non-POST', post({}, { method: 'GET' }), 405],
      [
        'missing protocol header',
        post(
          { name: 'quote_price' },
          { headers: { 'content-type': 'application/json' } }
        ),
        400,
      ],
      [
        'different protocol',
        post(
          { name: 'quote_price' },
          {
            headers: {
              'content-type': 'application/json',
              [PROTOCOL_HEADER]: '2',
            },
          }
        ),
        400,
      ],
      [
        'wrong media type',
        post(
          { name: 'quote_price' },
          { headers: { 'content-type': 'text/plain', [PROTOCOL_HEADER]: '1' } }
        ),
        415,
      ],
      ['malformed JSON', post('{'), 400],
      ['no name', post({ arguments: {} }), 400],
      ['array arguments', post({ name: 'quote_price', arguments: [] }), 400],
      ['bad context', post({ name: 'quote_price', context: { deadlineMs: -1 } }), 400],
      ['bad client', post({ name: 'quote_price', context: { client: {} } }), 400],
      ['unknown tool', post({ name: 'nope', arguments: {} }), 404],
    ];
    for (const [label, response, status] of cases) {
      const result = await statusOf(await response);
      expect({ label, status: result.status }).toEqual({ label, status });
      expect(result.protocol).toBe('1');
      expect(typeof result.body['error']).toBe('string');
    }
    const unsupported = await statusOf(
      await post({ name: 'x' }, { headers: { 'content-type': 'application/json' } })
    );
    expect(unsupported.body).toEqual({ error: 'unsupported protocol' });
    expect((await post({}, { method: 'GET' })).headers.get('allow')).toBe('POST');
  });

  it('runs a tool and returns the parsed structured content', async () => {
    const result = await statusOf(
      await post({
        name: 'quote_price',
        arguments: { sku: 'SKU-42', quantity: 3 },
      })
    );
    expect(result.status).toBe(200);
    expect(result.protocol).toBe('1');
    expect(result.body['structuredContent']).toEqual({ total: 30 });
  });

  it('reports invalid input, thrown errors and bad output as isError', async () => {
    const invalid = await statusOf(
      await post({ name: 'quote_price', arguments: { sku: 1, quantity: 0 } })
    );
    expect(invalid.status).toBe(200);
    expect(invalid.body).toMatchObject({ isError: true });
    expect(textOf(invalid.body)).toMatch(/Invalid arguments for tool "quote_price"/);

    expect((await statusOf(await post({ name: 'explode' }))).body).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'boom' }],
    });
    expect(textOf((await statusOf(await post({ name: 'no_structured' }))).body)).toMatch(
      /returned no structuredContent/
    );
    expect(textOf((await statusOf(await post({ name: 'bad_structured' }))).body)).toMatch(
      /does not match its outputSchema/
    );
    expect((await statusOf(await post({ name: 'failing_structured' }))).body).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'nope' }],
    });
  });

  // Contract 11.4: no JSON Schema validator ships in the isolate, so a plain
  // JSON Schema outputSchema only requires structuredContent to be an
  // object; MCP clients validate it against the advertised schema.
  it('only requires an object for a plain JSON Schema outputSchema', async () => {
    expect((await statusOf(await post({ name: 'plain_structured' }))).body).toMatchObject(
      { structuredContent: { ok: 'yes' } }
    );
    expect(
      (await statusOf(await post({ name: 'plain_structured' }))).body
    ).not.toHaveProperty('isError');
    expect(textOf((await statusOf(await post({ name: 'plain_text' }))).body)).toMatch(
      /returned no structuredContent/
    );
  });

  it('answers isError when a schema throws or a result is not JSON', async () => {
    const throwing = defineTool({
      name: 'throwing_schema',
      description: 'Its validator throws.',
      inputSchema: z.object({ a: z.string() }).transform(() => {
        throw new Error('validator blew up');
      }),
      handler: () => 'never',
    });
    const fragile = createProviderWorker(
      defineProvider({
        name: 'fragile',
        tools: [
          throwing,
          defineTool({
            name: 'bigint',
            description: 'Returns a BigInt.',
            handler: () => ({ content: [], n: 1n }),
          }),
        ],
      })
    );
    const call = async (name: string) => {
      const response = await fragile.fetch(
        new Request(CALL_TOOL_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [PROTOCOL_HEADER]: '1',
          },
          body: JSON.stringify({ name, arguments: { a: 'x' } }),
        })
      );
      return statusOf(response);
    };
    const schema = await call('throwing_schema');
    expect(schema).toMatchObject({ status: 200, protocol: '1' });
    expect(schema.body).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'validator blew up' }],
    });
    const bigint = await call('bigint');
    expect(bigint).toMatchObject({ status: 200, protocol: '1' });
    expect(textOf(bigint.body)).toMatch(/returned a result that is not valid JSON/);
  });

  it('answers 500 with the protocol header for an unexpected failure', async () => {
    const hostile = {
      get url(): string {
        throw new Error('no url');
      },
    } as unknown as Request;
    const result = await statusOf(await worker.fetch(hostile));
    expect(result).toEqual({
      status: 500,
      protocol: '1',
      body: { error: 'internal error' },
    });
  });

  it('passes client, caller and provider to the handler', async () => {
    const result = await statusOf(
      await post({
        name: 'whoami',
        context: {
          client: {
            name: 'claude-code',
            version: '2.1.0',
            protocolVersion: '2026-07-28',
          },
          caller: { id: 'user-1', organization: 'acme' },
        },
      })
    );
    expect(result.body['structuredContent']).toEqual({
      client: {
        protocolVersion: '2026-07-28',
        info: { name: 'claude-code', version: '2.1.0' },
      },
      caller: { id: 'user-1', organization: 'acme' },
      provider: { name: 'tools-basic', version: '1.0.0' },
    });
    const anonymous = await statusOf(await post({ name: 'whoami' }));
    expect(anonymous.body['structuredContent']).toMatchObject({
      client: {},
      caller: null,
    });
  });

  it('aborts the handler at deadlineMs', async () => {
    const result = await statusOf(
      await post({ name: 'wait', context: { deadlineMs: 20 } })
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Tool "wait" timed out after 20 ms' }],
    });
  });

  it('treats a deadline past the timer range as no deadline', async () => {
    // Timers overflow above 2^31-1 ms and fire at once; the call must run.
    const napping = createProviderWorker(
      defineProvider({
        name: 'nap',
        tools: [
          defineTool({
            name: 'nap',
            description: 'Resolve after a short pause.',
            handler: (_input, { signal }) =>
              new Promise((resolve, reject) => {
                const timer = setTimeout(() => resolve('rested'), 30);
                signal.addEventListener('abort', () => {
                  clearTimeout(timer);
                  reject(new Error('aborted'));
                });
              }),
          }),
        ],
      })
    );
    expect(
      await callProviderWorker(napping, {
        name: 'nap',
        context: { deadlineMs: 2 ** 32 },
      })
    ).toEqual({ content: [{ type: 'text', text: 'rested' }] });
  });

  it('aborts the handler when the request is cancelled', async () => {
    const controller = new AbortController();
    // Node's Request follows the init signal through a weak reference, and
    // nothing else roots a pending call here, so a GC could drop the abort.
    // A real host keeps the Request alive while the call is in flight.
    const request = new Request(CALL_TOOL_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [PROTOCOL_HEADER]: '1' },
      body: JSON.stringify({ name: 'wait' }),
      signal: controller.signal,
    });
    inFlight.add(request);
    const response = worker.fetch(request);
    setTimeout(() => controller.abort(), 10);
    const result = await statusOf(await response);
    expect(result.body).toMatchObject({ isError: true });
    expect(request.signal.aborted).toBe(true);
    inFlight.delete(request);
  });
});

describe('callProviderWorker', () => {
  it('calls a worker and returns its result', async () => {
    expect(
      await callProviderWorker(worker, {
        name: 'quote_price',
        arguments: { sku: 'SKU-42', quantity: 2 },
        context: { deadlineMs: 1000 },
      })
    ).toMatchObject({ structuredContent: { total: 20 } });
  });

  it('throws -32602 for an unknown tool and rejects off-protocol answers', async () => {
    await expect(callProviderWorker(worker, { name: 'nope' })).rejects.toMatchObject({
      name: 'ProviderCallError',
      status: 404,
      code: -32602,
    });
    const bare: ProviderFetcher = {
      fetch: () => Promise.resolve(Response.json({ content: [] })),
    };
    await expect(callProviderWorker(bare, { name: 'x' })).rejects.toThrow(
      ProviderCallError
    );
    const broken: ProviderFetcher = {
      fetch: () =>
        Promise.resolve(
          Response.json({ content: 'x' }, { headers: { [PROTOCOL_HEADER]: '1' } })
        ),
    };
    await expect(callProviderWorker(broken, { name: 'x' })).rejects.toThrow(
      /invalid tool result/
    );
  });

  it('caps the response body and keeps provider text out of the message', async () => {
    const answer = (body: string, status = 200, headers = {}) => ({
      fetch: () =>
        Promise.resolve(
          new Response(body, {
            status,
            headers: { [PROTOCOL_HEADER]: '1', ...headers },
          })
        ),
    });
    const large = JSON.stringify({
      content: [{ type: 'text', text: 'x'.repeat(64) }],
    });
    await expect(
      callProviderWorker(answer(large), { name: 'x', maxResponseBytes: 32 })
    ).rejects.toThrow(/over the 32-byte limit/);
    // A streamed body without content-length is counted as it arrives.
    const streamed: ProviderFetcher = {
      fetch: () =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                for (let index = 0; index < 4; index += 1) {
                  controller.enqueue(new TextEncoder().encode('x'.repeat(16)));
                }
                controller.close();
              },
            }),
            { headers: { [PROTOCOL_HEADER]: '1' } }
          )
        ),
    };
    await expect(
      callProviderWorker(streamed, { name: 'x', maxResponseBytes: 32 })
    ).rejects.toThrow(/over the 32-byte limit/);
    expect(await callProviderWorker(answer(large), { name: 'x' })).toMatchObject({
      content: [{ type: 'text' }],
    });

    const failure = await callProviderWorker(
      answer(JSON.stringify({ error: 'token=abc leaked' }), 500),
      { name: 'x' }
    ).catch((error: unknown) => error as ProviderCallError);
    expect(failure).toMatchObject({
      message: 'The provider answered 500',
      status: 500,
      providerError: 'token=abc leaked',
    });
    const unknown = await callProviderWorker(
      answer(JSON.stringify({ error: 'nope' }), 404),
      { name: 'missing' }
    ).catch((error: unknown) => error as ProviderCallError);
    expect(unknown).toMatchObject({
      message: 'Unknown tool: missing',
      code: -32602,
      providerError: 'nope',
    });
  });

  it('sends only the protocol headers and body', async () => {
    let seen: Request | undefined;
    const spy: ProviderFetcher = {
      fetch: (request) => {
        seen = request;
        return worker.fetch(request);
      },
    };
    await callProviderWorker(spy, { name: 'whoami' });
    expect(seen?.url).toBe(CALL_TOOL_URL);
    expect([...(seen?.headers.keys() ?? [])].sort()).toEqual([
      'content-type',
      PROTOCOL_HEADER,
    ]);
  });
});

describe('the fixture artifacts/tools-basic/tools/index.js', () => {
  it('answers the protocol', async () => {
    const module = (await import(
      pathToFileURL(path.join(contract, 'artifacts/tools-basic/tools/index.js')).href
    )) as { default: ProviderFetcher };
    const fixture = module.default;
    expect(
      (fixture as unknown as Record<symbol, SkillsProvider>)[PROVIDER_SYMBOL].name
    ).toBe('tools-basic');
    expect(Object.keys(fixture)).toEqual(['fetch']);

    expect(
      await callProviderWorker(fixture, {
        name: 'quote_price',
        arguments: { sku: 'SKU-42', quantity: 3 },
      })
    ).toEqual({
      content: [{ type: 'text', text: '3 x SKU-42 = 30.00 EUR' }],
      structuredContent: { total: 30 },
    });
    expect(
      await callProviderWorker(fixture, {
        name: 'quote_price',
        arguments: { sku: 'SKU-42', quantity: 0 },
      })
    ).toMatchObject({ isError: true });
    await expect(callProviderWorker(fixture, { name: 'nope' })).rejects.toMatchObject({
      code: -32602,
    });

    const call = (init: RequestInit & { url?: string }) =>
      fixture.fetch(new Request(init.url ?? CALL_TOOL_URL, init));
    expect((await call({ method: 'GET' })).status).toBe(405);
    expect(
      (await call({ method: 'POST', url: 'https://provider.internal/x' })).status
    ).toBe(404);
    expect(
      (
        await call({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
      ).status
    ).toBe(400);
    expect(
      (
        await call({
          method: 'POST',
          headers: { 'content-type': 'text/plain', [PROTOCOL_HEADER]: '1' },
          body: '{}',
        })
      ).status
    ).toBe(415);
  });
});

describe('toCatalogTool', () => {
  it('lists outputSchema with the output io', () => {
    const tool = toCatalogTool(
      defineTool({
        name: 'with_default',
        description: 'x',
        outputSchema: z.object({ n: z.string().default('x') }),
        handler: () => ({ n: 'y' }),
      })
    );
    expect(tool.outputSchema?.required).toEqual(['n']);
  });
});
