import { readFileSync } from 'node:fs';
import { type DeployResult } from 'zephyr-agent';
import { buildResultsPath } from './constants';

type DeployResults = Record<string, DeployResult>;

describe('e2e examples deployments', () => {
  const rawFile = readFileSync(buildResultsPath).toString();
  const buildResults: DeployResults = JSON.parse(rawFile);

  const resultEntries = Object.entries(buildResults);

  for (const [app, result] of resultEntries) {
    it(
      `should correctly deploy assets from app: ${app}`,
      async () => {
        const assetEntries = Object.values(result.snapshot.assets);
        const promises = assetEntries.map(async (asset) => {
          return fetchWithRetries(`${result.urls[0]}/${asset.path}`, 1);
        });

        const results = await Promise.all(promises);
        results.forEach((res) => {
          expect(res.ok).toBe(true);
          expect(res.status).toBe(200);
        });
      },
      5 * 60 * 1000
    );
  }
});

const fetchWithRetries = async (url: string, retries = 1) => {
  const res = await fetch(url, { method: 'HEAD' });

  if (res.status === 200 || retries === 1) return res;

  await new Promise((resolve) => setTimeout(resolve, 5 * 1000));

  return fetchWithRetries(url, retries - 1);
};
