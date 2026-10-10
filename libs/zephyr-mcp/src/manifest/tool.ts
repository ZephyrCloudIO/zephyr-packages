import { toJsonSchema } from '../tools';
import { RuleError } from '../rules';
import type { ToolDefinition, ToolSchema } from '../types';
import type { CatalogJsonSchema, CatalogTool } from './catalog';
import { isObject } from '../object';

const DEFS_REF = '#/$defs/';

// JSON Pointer unescaping for a single reference token.
const unescapePointer = (token: string) =>
  decodeURIComponent(token).replace(/~1/g, '/').replace(/~0/g, '~');

/** Replaces a root `$ref: '#/$defs/X'` with `X`, keeping `$defs` for recursion. */
const inlineRootRef = (
  schema: Record<string, unknown>,
  label: string
): Record<string, unknown> => {
  const { $ref: ref, ...rest } = schema;
  if (ref === undefined) return schema;
  const defs = schema['$defs'];
  const target =
    typeof ref === 'string' && ref.startsWith(DEFS_REF) && isObject(defs)
      ? defs[unescapePointer(ref.slice(DEFS_REF.length))]
      : undefined;
  if (!isObject(target)) {
    throw new RuleError(
      'tool-schema-invalid',
      `${label} has a root $ref that does not point into its $defs`
    );
  }
  return { ...target, ...rest };
};

const toCatalogSchema = (
  schema: ToolSchema,
  io: 'input' | 'output',
  label: string
): CatalogJsonSchema => {
  let json: Record<string, unknown>;
  try {
    const converted = toJsonSchema(schema, io);
    // A JSON round trip proves the schema is serializable and detaches it
    // from the library's own objects.
    json = JSON.parse(JSON.stringify(converted)) as Record<string, unknown>;
  } catch (error) {
    throw new RuleError(
      'tool-schema-invalid',
      `${label} cannot be converted to JSON Schema: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  if (!isObject(json)) {
    throw new RuleError('tool-schema-invalid', `${label} is not an object`);
  }
  delete json['$schema'];
  const inlined = inlineRootRef(json, label);
  if (inlined['type'] !== 'object') {
    throw new RuleError(
      'tool-schema-invalid',
      `${label} must describe an object (root type "object"), e.g. z.object({ ... })`
    );
  }
  return inlined as CatalogJsonSchema;
};

/**
 * A tool as listed in `catalog.json`: draft 2020-12 JSON Schemas without `$schema`, a
 * root `$ref` inlined, and an object root. A tool without an `inputSchema` takes `{ type:
 * 'object' }`. Throws a {@link RuleError} (`tool-schema-invalid`) for a schema it cannot
 * convert, and (`tool-export-invalid`) for a missing name or description.
 *
 * @example
 *   ```ts
 *   import quotePrice from './tools/quote_price';
 *   toCatalogTool(quotePrice, { name: 'quote_price' });
 *   ```;
 */
export function toCatalogTool(
  tool: ToolDefinition<ToolSchema | undefined>,
  options: { name?: string } = {}
): CatalogTool {
  const name = options.name ?? tool.name;
  if (typeof name !== 'string' || name.length === 0) {
    throw new RuleError('tool-export-invalid', 'the tool has no name');
  }
  if (typeof tool.description !== 'string' || tool.description.length === 0) {
    throw new RuleError('tool-export-invalid', `tool "${name}" needs a description`);
  }
  const label = `tool "${name}"`;
  const inputSchema = tool.inputSchema
    ? toCatalogSchema(tool.inputSchema, 'input', `${label} inputSchema`)
    : ({ type: 'object' } as const);
  const outputSchema =
    tool.outputSchema &&
    toCatalogSchema(tool.outputSchema, 'output', `${label} outputSchema`);
  const title = tool.title ?? tool.annotations?.title;
  return {
    name,
    ...(title !== undefined && { title }),
    description: tool.description,
    inputSchema,
    ...(outputSchema && { outputSchema }),
    ...(tool.annotations && { annotations: { ...tool.annotations } }),
  };
}
