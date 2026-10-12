// The entry of every tools/index.js the Rslib preset builds. Rslib needs an
// entry on disk, so this file ships in the package; the preset generates
// only the module it imports, which lists the repo's tool files.
// @ts-expect-error The preset aliases this to a generated module.
import * as generated from '__zephyr_mcp_tools__';
import { createProviderWorker } from '../worker/handler';
import { SKILLS_PROVIDER_KIND, type AnySkillTool } from '../types';
import { TOOL_MODULE_SYMBOL } from './symbols';
import { isObject } from '../object';

interface GeneratedTools {
  name: string;
  version?: string;
  /** `[tool name, repo-relative file, module namespace]` per tool file. */
  modules: Array<[string, string, { default?: unknown }]>;
}

const { name, version, modules } = generated as unknown as GeneratedTools;

// The file name is the tool name. What the module really exported stays
// readable for the preset's checks, which report a missing export or a
// `name` that differs from the file.
const tools = modules.map(([toolName, file, namespace]) =>
  Object.defineProperty(
    {
      ...(isObject(namespace.default) ? namespace.default : {}),
      name: toolName,
    },
    TOOL_MODULE_SYMBOL,
    { value: { file, exported: namespace.default }, enumerable: false }
  )
) as unknown as AnySkillTool[];

export default createProviderWorker({
  kind: SKILLS_PROVIDER_KIND,
  name,
  version,
  skills: [],
  tools,
});
