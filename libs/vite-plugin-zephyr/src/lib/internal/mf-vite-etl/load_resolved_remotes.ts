import { ZeResolvedDependency } from 'zephyr-agent';
import {
  parseRemoteMap,
  RemoteMapExtraction,
  replaceProtocolAndHost,
} from './remote_map_parser';

export function load_resolved_remotes(
  resolved_remotes: ZeResolvedDependency[],
  code: string,
  id: string
) {
  const extractedRemotes = parseRemoteMap(code, id);
  if (extractedRemotes === undefined) return;

  const remotes: RemoteMapExtraction['remotesMap'] = [];
  const { remotesMap, startIndex, endIndex } = extractedRemotes;
  for (const remote of remotesMap) {
    const { name, entry, type } = remote;
    const remoteDetails = resolved_remotes.find(
      (r) => r.name === name && r.version === entry
    );
    if (!remoteDetails) continue;

    const updatedUrl = replaceProtocolAndHost(entry, remoteDetails.remote_entry_url);
    remotes.push({
      name,
      type,
      entryGlobalName: name,
      entry: updatedUrl,
    });
  }
  return code.slice(0, startIndex) + JSON.stringify(remotes) + code.slice(endIndex);
}
