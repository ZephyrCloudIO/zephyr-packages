import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';

export async function getCacheKey(application_uid: string): Promise<string> {
  let edgeUrl = (await getApplicationConfiguration({ application_uid }))?.EDGE_URL || '';
  if (edgeUrl) {
    edgeUrl = new URL(edgeUrl).host;
  }

  return `${application_uid}-${edgeUrl}`;
}
