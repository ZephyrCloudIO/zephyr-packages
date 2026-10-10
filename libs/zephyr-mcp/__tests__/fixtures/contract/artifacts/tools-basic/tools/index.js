const PROTOCOL = '1';
const tools = {
  quote_price: {
    name: 'quote_price',
    description: 'Price a basket with the checkout pricing rules.',
    annotations: { readOnlyHint: true },
    validate(args) {
      if (!args || typeof args !== 'object') return 'arguments must be an object';
      if (typeof args.sku !== 'string') return 'sku must be a string';
      if (!Number.isInteger(args.quantity) || args.quantity < 1) return 'quantity must be an integer >= 1';
      return null;
    },
    run(args) {
      const total = args.quantity * 10;
      return { content: [{ type: 'text', text: `${args.quantity} x ${args.sku} = ${total.toFixed(2)} EUR` }], structuredContent: { total } };
    },
  },
};
const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'x-federated-mcp-protocol': PROTOCOL },
});
const worker = {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/call-tool') return json(404, { error: 'not found' });
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
    if (request.headers.get('x-federated-mcp-protocol') !== PROTOCOL) return json(400, { error: 'unsupported protocol' });
    const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') return json(415, { error: 'unsupported media type' });
    let body;
    try { body = await request.json(); } catch { return json(400, { error: 'malformed body' }); }
    if (!body || typeof body.name !== 'string') return json(400, { error: 'malformed body' });
    const tool = tools[body.name];
    if (!tool) return json(404, { error: `unknown tool ${body.name}` });
    const problem = tool.validate(body.arguments);
    if (problem) return json(200, { content: [{ type: 'text', text: problem }], isError: true });
    try { return json(200, tool.run(body.arguments)); }
    catch (error) { return json(200, { content: [{ type: 'text', text: String(error && error.message || error) }], isError: true }); }
  },
};
Object.defineProperty(worker, Symbol.for('module-federation.mcp.provider'), {
  value: { kind: 'module-federation/skills-provider', name: 'tools-basic', tools: Object.values(tools), skills: [] },
  enumerable: false,
});
export default worker;
