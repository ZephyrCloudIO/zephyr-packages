import type { FederationRuntimePlugin } from '@module-federation/runtime';
import acorn from 'acorn';
import walk from 'acorn-walk';
import type { ZeResolvedDependency } from 'zephyr-agent';
import { ze_log } from 'zephyr-agent';

export function load_resolved_remotes(
  resolved_remotes: ZeResolvedDependency[],
  code: string
): string {
  const startTime = Date.now();

  try {
    // Parse the code into an AST
    const ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      ranges: true,
    });

    let pluginsArrayNode: acorn.Node | undefined;

    // Find the plugins array in the runtimeInit call
    walk.simple(ast, {
      CallExpression(node: any) {
        if (node.callee?.name === 'runtimeInit' && node.arguments?.length > 0) {
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
      ze_log('Could not find plugins array in remote entry');
      return code;
    }

    // Extract the plugins array
    const pluginsArrayStart = pluginsArrayNode.start;
    const pluginsArrayEnd = pluginsArrayNode.end;
    const pluginsArray = code.slice(pluginsArrayStart, pluginsArrayEnd);

    // Add Zephyr plugin to the array
    // We need to add a Zephyr plugin to the end of the array
    // The array is in format: [plugin1(), plugin2(), ...] or []
    let updatedPluginsArray;
    const runtimePlugin = generateRuntimePlugin(resolved_remotes);

    if (pluginsArray === '[]') {
      // Handle empty array case
      updatedPluginsArray = `[${runtimePlugin}]`;
    } else {
      // Handle non-empty array case
      updatedPluginsArray = pluginsArray.replace(/\]$/, `, ${runtimePlugin}]`);
    }

    // Replace the original array with the updated one
    const updatedCode =
      code.substring(0, pluginsArrayStart) +
      updatedPluginsArray +
      code.substring(pluginsArrayEnd);

    const endTime = Date.now();
    ze_log(`load_resolved_remotes took ${endTime - startTime}ms`);
    return updatedCode;
  } catch (error) {
    ze_log('Error in load_resolved_remotes:', error);
    return code; // Return original code in case of error
  }
}

function generateRuntimePlugin(resolved_remotes: ZeResolvedDependency[]): string {
  const remoteMap = Object.fromEntries(
    resolved_remotes.map((remote) => [remote.name, remote])
  );
  const runtimePlugin: FederationRuntimePlugin = {
    name: 'zephyr-runtime-remote-resolver',
    beforeInit: (args) => {
      const resolvedRemoteMap: Record<string, ZeResolvedDependency> =
        JSON.parse('__REMOTE_MAP__');
      const _windows = typeof window !== 'undefined' ? window : globalThis;
      args.userOptions.remotes.forEach((remote) => {
        const resolvedRemote = resolvedRemoteMap[remote.name];
        if (!resolvedRemote) return;
        const sessionEdgeURL = _windows.sessionStorage.getItem(
          resolvedRemote.application_uid
        );

        const urlOverwrite = sessionEdgeURL ?? resolvedRemote.remote_entry_url;

        // @ts-expect-error overwriting entry if needed
        remote.entry = urlOverwrite;
      });
      return args;
    },
  };
  return objectToTemplate(runtimePlugin).replace(
    '__REMOTE_MAP__',
    JSON.stringify(remoteMap)
  );
}

function objectToTemplate(obj: FederationRuntimePlugin): string {
  const entries = Object.entries(obj).map(([key, value]) => {
    if (typeof value === 'function') {
      return `${key}: ${value.toString()}`;
    } else if (typeof value === 'object' && value !== null) {
      return `${key}: ${objectToTemplate(value)}`;
    } else if (typeof value === 'string') {
      return `${key}: "${value}"`;
    } else {
      return `${key}: ${value}`;
    }
  });
  return `{ ${entries.join(', ')} }`;
}
