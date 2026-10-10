import type {
  AnySkillTool,
  CallToolResult,
  JsonSchemaObject,
  StandardSchemaResult,
  StandardSchemaWithJSON,
  ToolContext,
  ToolHandlerResult,
  ToolSchema,
} from './types';

export const isStandardSchema = (schema: ToolSchema): schema is StandardSchemaWithJSON =>
  typeof schema === 'object' && schema !== null && '~standard' in schema;

/**
 * A tool schema as the JSON Schema object MCP clients receive: the input type for
 * `inputSchema`, the output type for `outputSchema`.
 */
export const toJsonSchema = (
  schema: ToolSchema | undefined,
  io: 'input' | 'output' = 'input'
): JsonSchemaObject | undefined => {
  if (!schema) return undefined;
  let json: Record<string, unknown>;
  if (isStandardSchema(schema)) {
    const convert = schema['~standard'].jsonSchema?.[io];
    if (typeof convert !== 'function') {
      throw new Error(
        `This ${schema['~standard'].vendor} schema has no JSON Schema ${io} conversion; use zod 4.2+ or another Standard JSON Schema library`
      );
    }
    json = convert({ target: 'draft-2020-12' });
  } else {
    json = { ...schema };
  }
  delete json['$schema'];
  return json as JsonSchemaObject;
};

type Issues = Extract<StandardSchemaResult<unknown>, { issues: unknown }>['issues'];

const formatIssues = (issues: Issues) =>
  issues
    .map((issue) => {
      const path = (issue.path ?? [])
        .map((segment) =>
          typeof segment === 'object' ? String(segment.key) : String(segment)
        )
        .join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');

const toolLabel = (tool: AnySkillTool) => `"${tool.name}"`;

/**
 * Validate tool arguments. Plain JSON Schema is advertised to clients but not validated
 * here.
 */
export const validateToolInput = async (
  tool: AnySkillTool,
  payload: unknown
): Promise<{ value: unknown } | { error: string }> => {
  const schema = tool.inputSchema as ToolSchema | undefined;
  if (!schema || !isStandardSchema(schema)) return { value: payload ?? {} };
  const result = await schema['~standard'].validate(payload ?? {});
  return result.issues
    ? {
        error: `Invalid arguments for tool ${toolLabel(tool)}: ${formatIssues(result.issues)}`,
      }
    : { value: result.value };
};

/**
 * Check a successful result against the tool's `outputSchema`. A Standard Schema
 * validates `structuredContent` and the parsed value replaces it; a plain JSON Schema
 * only requires `structuredContent` to be an object, since no JSON Schema validator ships
 * in the isolate. MCP clients validate it against the advertised `outputSchema`; use a
 * Standard Schema (zod) to have the tool's own output checked.
 */
export const validateToolOutput = async (
  tool: AnySkillTool,
  result: CallToolResult
): Promise<CallToolResult> => {
  const schema = tool.outputSchema;
  if (!schema || result.isError) return result;
  const { structuredContent } = result;
  if (
    typeof structuredContent !== 'object' ||
    structuredContent === null ||
    Array.isArray(structuredContent)
  ) {
    return errorResult(
      new Error(
        `Tool ${toolLabel(tool)} declares an outputSchema but returned no structuredContent`
      )
    );
  }
  if (!isStandardSchema(schema)) return result;
  const parsed = await schema['~standard'].validate(structuredContent);
  if (parsed.issues) {
    return errorResult(
      new Error(
        `Tool ${toolLabel(tool)} returned structuredContent that does not match its outputSchema: ${formatIssues(parsed.issues)}`
      )
    );
  }
  return {
    ...result,
    structuredContent: parsed.value as Record<string, unknown>,
  };
};

const isCallToolResult = (value: unknown): value is CallToolResult =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as CallToolResult).content);

/** Turn whatever a tool handler returned into an MCP tool result. */
export const toCallToolResult = (value: ToolHandlerResult): CallToolResult => {
  if (isCallToolResult(value)) return value;
  if (value === undefined) return { content: [] };
  if (typeof value === 'string') {
    return { content: [{ type: 'text', text: value }] };
  }
  const text = JSON.stringify(value, null, 2);
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return {
      content: [{ type: 'text', text }],
      structuredContent: value,
    };
  }
  return { content: [{ type: 'text', text }] };
};

export const errorResult = (error: unknown): CallToolResult => ({
  isError: true,
  content: [
    {
      type: 'text',
      text: error instanceof Error ? error.message : String(error),
    },
  ],
});

/**
 * Run a tool: validate the arguments, call the handler, turn its return value or error
 * into a result, and check the result against the output schema. Shared by
 * `catalog.callTool` and the provider worker so both behave the same.
 */
export const invokeTool = async (
  tool: AnySkillTool,
  args: unknown,
  context: ToolContext
): Promise<CallToolResult> => {
  try {
    // Invalid arguments are reported as tool errors (not protocol errors) so
    // the model can read the message and retry, as MCP recommends. A schema
    // that throws while validating is a tool error too.
    const input = await validateToolInput(tool, args);
    if ('error' in input) return errorResult(new Error(input.error));
    return await validateToolOutput(
      tool,
      toCallToolResult(await tool.handler(input.value, context))
    );
  } catch (error) {
    return errorResult(error);
  }
};
