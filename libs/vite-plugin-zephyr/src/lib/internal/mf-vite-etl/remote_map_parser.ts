import json5 from 'json5';
import acorn from 'acorn';
import walk from 'acorn-walk';
import { ze_log } from 'zephyr-agent';
import type { ApplicationConsumes } from 'zephyr-edge-contract';

export interface RemoteEntry {
  name: string;
  entryGlobalName?: string;
  entry: string;
  type?: string;
}

export interface RemoteMapExtraction {
  remotesMap: RemoteEntry[];
  startIndex: number;
  endIndex: number;
}

/**
 * Parses the provided code to extract the remotes object.
 *
 * @param code - The code containing the remotes object declaration.
 * @returns An object containing the remotes object and the start and end indices of the
 *   remotes object declaration in the code, or undefined if parsing fails.
 */
export function parseRemoteMapAndImportedRemotes(
  code: string,
  id: string,
  remotes?: string[]
): RemoteMapExtraction | undefined {
  let remoteNamesAndImports: acorn.Node | undefined;
  function isImportedRemote(node: acorn.CallExpression) {
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === '__vitePreload' &&
      node.arguments.length >= 1
    ) {
      ze_log('vite.isImportedRemote.node: ', node);
      for (const arg of node.arguments) {
        ze_log('vite.isImportedRemote.arg Pos1: ', arg);
        if (
          arg.type === 'ArrowFunctionExpression' &&
          arg.body.type === 'CallExpression' &&
          arg.body.callee?.type === 'Identifier' &&
          arg.body.callee.name === 'import' &&
          arg.body.arguments.length === 1
        ) {
          ze_log('vite.isImportedRemote.arg Pos2: ', arg);
          remoteNamesAndImports = arg.body.arguments[0];
          return true;
        }
      }
    }
    return false;
  }

  if (!id.includes('localSharedImportMap') || id.includes('node_modules')) {
    return undefined;
  }
  let arrayNode: acorn.Node | undefined;

  const startTime = Date.now();

  // Parse the code into an AST
  const ast = acorn.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true, // Include line and column numbers
    ranges: true, // Include start and end indices
  });

  // Visitor function to find the variable declaration
  function findUsedRemotes(node: acorn.VariableDeclaration) {
    if (node.type === 'VariableDeclaration' && node.kind === 'const') {
      for (const declarator of node.declarations) {
        if (
          declarator.id.type === 'Identifier' &&
          declarator.id.name === 'usedRemotes' &&
          declarator.init
        ) {
          // Found the 'usedRemotes' variable
          arrayNode = declarator.init;
          break;
        }
      }
    }
  }

  walk.simple(ast, {
    VariableDeclaration: findUsedRemotes,
    CallExpression: isImportedRemote,
    // ImportDeclaration: isImportedRemote,
  });

  const endTime = Date.now();
  ze_log(`parseRemoteMap took ${endTime - startTime}ms`);

  if (!arrayNode) {
    return;
  }
  ze_log('vite.arrayNode found: ', arrayNode);

  // Get start and end indices
  const startIndex = arrayNode.start;
  const endIndex = arrayNode.end;

  // Extract the array text from the code
  const arrayText = code.slice(startIndex, endIndex);
  let remotesArray: RemoteEntry[];

  try {
    // Use a faster JSON parser if possible
    remotesArray = JSON.parse(arrayText) as RemoteEntry[];
    ze_log('vite.parseRemoteMap.remotesArray: ', remotesArray);
  } catch (error) {
    // Fallback to json5 only if necessary
    ze_log(error);
    try {
      remotesArray = json5.parse(arrayText);
    } catch (innerError) {
      ze_log(innerError);
      return;
    }
  }

  return {
    remotesMap: remotesArray,
    startIndex,
    endIndex,
    // consumes: remoteNamesAndImports,
  };
}

export function replaceProtocolAndHost(
  originalUrl: string,
  newProtocolAndHost: string
): string {
  ze_log('vite.replaceProtocalAndHost.originalUrl: ', originalUrl);
  ze_log('vite.replaceProtocalAndHost: ', newProtocolAndHost);
  const url = new URL(originalUrl);
  const newUrl = new URL(newProtocolAndHost);

  // Replace protocol and hostname
  url.protocol = newUrl.protocol;
  url.hostname = newUrl.hostname;
  url.port = '';

  ze_log('vite.transformedUrl: ', url.toString());

  return url.toString();
}
