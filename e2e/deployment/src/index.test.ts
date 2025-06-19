import { readFileSync } from 'node:fs';
import { getAppDeployResult } from 'zephyr-agent';
import { testTargetsPath } from './constants';

const rawFile = readFileSync(testTargetsPath).toString();
const testTargets: string[] = JSON.parse(rawFile);

for (const appUid of testTargets) {
  describe(`[${appUid}]: asset deployment assertion`, () => {
    it(
      'should have correctly deployed assets',
      async () => {
        const deployResult = await getAppDeployResult(appUid);

        if (!deployResult) {
          return fail(`Deployment result for ${appUid} was not cached properly.`);
        }

        const assetEntries = Object.values(deployResult.snapshot.assets);
        const promises = assetEntries.map(async (asset) => {
          return fetchWithRetries(`${deployResult.urls[0]}/${asset.path}`, 3);
        });

        const results = await Promise.all(promises);
        results.forEach((res) => {
          expect(res.ok).toBe(true);
          expect(res.status).toBe(200);
        });
      },
      90 * 1000
    );
  });
}

const fetchWithRetries = async (url: string, attemptsLeft = 1) => {
  const res = await fetch(url, { method: 'HEAD' });

  if (res.status === 200 || attemptsLeft <= 1) return res;

  await new Promise((resolve) => setTimeout(resolve, 5 * 1000));

  return fetchWithRetries(url, attemptsLeft - 1);
};
