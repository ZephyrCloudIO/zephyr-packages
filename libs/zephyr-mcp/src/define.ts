import type { SkillTool, ToolDefinition, ToolSchema } from './types';
import { assertToolName } from './validate';

/**
 * Define a tool. The handler's input type is inferred from `inputSchema`, which can be
 * any Standard Schema with JSON Schema support (zod 4, valibot, arktype, ...) or a plain
 * JSON Schema object.
 *
 * `name` is optional in a repo's `tools/<name>.ts`, where the file name is the tool name;
 * when given there, it must equal the file name. It is validated only when present, and
 * the definition is returned unchanged.
 *
 * @example
 *   ```ts
 *   defineTool({
 *   name: 'lookup_order',
 *   description: 'Fetch an order by id.',
 *   inputSchema: z.object({ id: z.string() }),
 *   annotations: { readOnlyHint: true },
 *   async handler({ id }) {
 *   return await orders.get(id); // objects become structured content
 *   },
 *   });
 *
 *   // tools/lookup_order.ts: the name comes from the file
 *   export default defineTool({ description: 'Fetch an order by id.', ... });
 *   ```;
 */
export function defineTool<S extends ToolSchema | undefined = undefined>(
  tool: SkillTool<S>
): SkillTool<S>;
export function defineTool<S extends ToolSchema | undefined = undefined>(
  tool: ToolDefinition<S>
): ToolDefinition<S>;
export function defineTool<S extends ToolSchema | undefined = undefined>(
  tool: ToolDefinition<S>
): ToolDefinition<S> {
  // Only the name is checked here. A missing handler is reported where the
  // tool is used: the provider worker skips it, and the Rslib preset
  // reports ZD0736 for the file instead of failing on import.
  if (tool.name !== undefined) assertToolName(tool.name);
  return tool;
}
