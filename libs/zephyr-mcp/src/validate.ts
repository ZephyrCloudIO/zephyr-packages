/** Agent Skills name: lowercase letters, digits and single hyphens. */
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Tool names, the same everywhere: repo, catalog, API and MCP. */
export const TOOL_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const MAX_SKILL_NAME_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 1024;
export const MAX_COMPATIBILITY_LENGTH = 500;

/** Names the Zephyr MCP keeps for its own tools; never valid for a catalog tool. */
export const RESERVED_TOOL_NAMES: readonly string[] = [
  'search',
  'execute',
  'connection_status',
];

/** A skill name that is also valid as a skill folder name. */
export const isSkillName = (name: unknown): boolean =>
  typeof name === 'string' &&
  name.length <= MAX_SKILL_NAME_LENGTH &&
  SKILL_NAME_PATTERN.test(name) &&
  name !== 'evals';

export const assertToolName = (name: unknown): string => {
  if (typeof name !== 'string' || !TOOL_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid tool name "${String(name)}": use 1-64 letters, digits, "_" or "-" (e.g. "lookup_order")`
    );
  }
  return name;
};
