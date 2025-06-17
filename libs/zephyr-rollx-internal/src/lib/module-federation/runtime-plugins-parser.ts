import { parse } from 'acorn';
import { simple as walk } from 'acorn-walk';

export interface PluginArrayLocation {
  start: number;
  end: number;
  hasExistingPlugins: boolean;
}

/**
 * Parses JavaScript code to find and locate the runtime plugins array
 * for Module Federation runtime initialization
 */
export function parseRuntimePlugin(code: string): PluginArrayLocation | null {
  try {
    const ast = parse(code, { 
      ecmaVersion: 'latest', 
      sourceType: 'module' 
    });

    let pluginArrayLocation: PluginArrayLocation | null = null;

    walk(ast, {
      CallExpression(node: any) {
        // Look for runtimeInit calls
        if (
          node.callee?.name === 'runtimeInit' ||
          (node.callee?.type === 'MemberExpression' && 
           node.callee?.property?.name === 'runtimeInit')
        ) {
          // Check if the call has an object argument
          if (node.arguments?.[0]?.type === 'ObjectExpression') {
            const configObject = node.arguments[0];
            
            // Look for plugins property in the configuration object
            for (const prop of configObject.properties) {
              if (
                prop.type === 'Property' &&
                ((prop.key?.type === 'Identifier' && prop.key?.name === 'plugins') ||
                 (prop.key?.type === 'Literal' && prop.key?.value === 'plugins'))
              ) {
                if (prop.value?.type === 'ArrayExpression') {
                  const pluginsArray = prop.value;
                  pluginArrayLocation = {
                    start: pluginsArray.start,
                    end: pluginsArray.end,
                    hasExistingPlugins: pluginsArray.elements.length > 0
                  };
                }
                break;
              }
            }
          }
        }
      }
    });

    return pluginArrayLocation;
  } catch (error) {
    console.warn('Failed to parse runtime plugin code:', error);
    return null;
  }
}

/**
 * Injects a runtime plugin into the plugins array of Module Federation runtime code
 */
export function injectRuntimePlugin(
  code: string, 
  pluginCode: string
): string {
  const pluginLocation = parseRuntimePlugin(code);
  
  if (!pluginLocation) {
    console.warn('Could not find plugins array in runtime code');
    return code;
  }

  const { start, end, hasExistingPlugins } = pluginLocation;
  
  // Prepare the plugin injection
  const pluginToInject = hasExistingPlugins 
    ? `, ${pluginCode}` 
    : pluginCode;

  // Insert the plugin into the array
  const beforeArray = code.substring(0, end - 1); // Before closing bracket
  const afterArray = code.substring(end - 1); // From closing bracket onwards
  
  return beforeArray + pluginToInject + afterArray;
}