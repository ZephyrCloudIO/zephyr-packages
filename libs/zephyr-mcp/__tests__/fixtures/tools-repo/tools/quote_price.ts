// A real repo imports from 'zephyr-mcp'.
import { defineTool } from '../../../../src/index';
import * as z from 'zod';
import { priceOf } from './lib/pricing';

export default defineTool({
  description: 'Price a basket with the checkout pricing rules.',
  inputSchema: z.object({ sku: z.string(), quantity: z.int().min(1) }),
  outputSchema: z.object({ total: z.number() }),
  annotations: { readOnlyHint: true },
  handler: ({ sku, quantity }) => {
    const total = priceOf(quantity);
    return {
      content: [
        {
          type: 'text',
          text: `${quantity} x ${sku} = ${total.toFixed(2)} EUR`,
        },
      ],
      structuredContent: { total },
    };
  },
});
