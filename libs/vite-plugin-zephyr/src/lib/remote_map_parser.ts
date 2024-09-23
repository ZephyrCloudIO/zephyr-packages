import json5 from 'json5';
import { ze_error } from 'zephyr-edge-contract';

export interface RemoteMapExtraction {
  remotesMap: {
    [index: string]: { url: string };
  };
  startIndex: number;
  endIndex: number;
}

/**
 * Parses the provided code to extract the remotesMap object.
 *
 * @param code - The code containing the remotesMap declaration.
 * @returns An object containing the remotesMap as a Record<string, string> and the start and end indices of the remotesMap declaration in the code, or undefined if parsing fails.
 */
export async function parseRemoteMap(code: string): Promise<RemoteMapExtraction | undefined> {
  try {
    const { js } = await import('@ast-grep/napi');
    const tree = js.parse(code);
    const root = tree.root();

    const objectNode = root.find(`const remotesMap = $OBJECT;`);

    if (!objectNode) {
      ze_error('ERR_NOT_RESOLVE_APP_NAME_WITH_VERSION', 'Failed to find remotesMap declaration.');
      return;
    }

    const variableDeclaratorNode = objectNode.children().find((child) => child.kind() === 'variable_declarator');

    if (!variableDeclaratorNode) {
      ze_error(
        'ERR_NOT_RESOLVE_APP_NAME_WITH_VERSION',
        'Failed to extract object literal from remotesMap declaration: variable_declarator.'
      );
      return;
    }

    const objectLiteralNode = variableDeclaratorNode.children().find((child) => child.kind() === 'object');

    if (!objectLiteralNode) {
      ze_error('ERR_NOT_RESOLVE_APP_NAME_WITH_VERSION', 'Failed to extract object literal from remotesMap declaration: object');
      return;
    }
    const remotesMapObject = json5.parse<RemoteMapExtraction['remotesMap']>(objectLiteralNode.text() || '');
    return {
      remotesMap: remotesMapObject,
      startIndex: objectNode.range().start.index,
      endIndex: objectNode.range().end.index,
    };
  } catch (error) {
    ze_error('ERR_NOT_RESOLVE_APP_NAME_WITH_VERSION', 'Failed to parse or modify remotesMap:', error);
  }

  return;
}

export function replaceProtocolAndHost(originalUrl: string, newProtocolAndHost: string): string {
  const url = new URL(originalUrl);
  const newUrl = new URL(newProtocolAndHost);

  // Replace protocol and hostname
  url.protocol = newUrl.protocol;
  url.hostname = newUrl.hostname;

  return url.toString();
}
