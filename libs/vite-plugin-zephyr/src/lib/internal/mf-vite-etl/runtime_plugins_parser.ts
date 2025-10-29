import acorn from 'acorn';
import walk from 'acorn-walk';
import { ze_log } from 'zephyr-agent';

export interface RuntimePluginsExtraction {
  pluginsArray: string;
  startIndex: number;
  endIndex: number;
}

export function parseRuntimePlugin(code: string): RuntimePluginsExtraction | undefined {
  // Parse the code into an AST
  const ast = acorn.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
    ranges: true,
  });

  let pluginsArrayNode: acorn.Node | undefined;

  // Find the plugins array in the runtimeInit call (both original and minified)
  walk.simple(ast, {
    CallExpression(node: any) {
      // Check for both 'runtimeInit' and 'p.init' (minified)
      const isRuntimeInit = node.callee?.name === 'runtimeInit';
      const isMinifiedInit =
        node.callee?.object?.name === 'p' && node.callee?.property?.name === 'init';

      if ((isRuntimeInit || isMinifiedInit) && node.arguments?.length > 0) {
        const initArg = node.arguments[0];

        if (initArg.type === 'ObjectExpression') {
          for (const prop of initArg.properties) {
            if (
              prop.key.type === 'Identifier' &&
              prop.key.name === 'plugins' &&
              prop.value.type === 'ArrayExpression'
            ) {
              pluginsArrayNode = prop.value;
              break;
            }
          }
        }
      }
    },
  });

  if (
    !pluginsArrayNode ||
    !('start' in pluginsArrayNode) ||
    !('end' in pluginsArrayNode)
  ) {
    ze_log.mf('Could not find plugins array in remote entry');
    return undefined;
  }

  // Extract the plugins array
  const startIndex = pluginsArrayNode.start;
  const endIndex = pluginsArrayNode.end;
  const pluginsArray = code.slice(startIndex, endIndex);

  return { pluginsArray, startIndex, endIndex };
}
