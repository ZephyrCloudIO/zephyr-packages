/**
 * Non-enumerable property of each tool in a preset build: the tool's file and its
 * module's real default export, for the preset's checks.
 */
export const TOOL_MODULE_SYMBOL: unique symbol = Symbol.for('zephyr-mcp.tool-module');

/** The bare specifier the preset aliases to the generated tool list. */
export const GENERATED_TOOLS_SPECIFIER = '__zephyr_mcp_tools__';
