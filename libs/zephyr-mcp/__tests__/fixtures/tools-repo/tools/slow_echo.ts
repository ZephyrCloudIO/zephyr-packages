// A real repo imports from 'zephyr-mcp'.
import { defineTool } from '../../../../src/index';
import * as z from 'zod';

export default defineTool({
  name: 'slow_echo',
  description: 'Echo a message once the signal aborts or after a delay.',
  inputSchema: z.object({ message: z.string(), delayMs: z.int().min(0) }),
  annotations: { readOnlyHint: true },
  handler: ({ message, delayMs }, { signal, client, caller }) =>
    new Promise((resolve) => {
      const timer = setTimeout(
        () => resolve({ message, client, caller: caller ?? null }),
        delayMs,
      );
      signal.addEventListener('abort', () => clearTimeout(timer));
    }),
});
