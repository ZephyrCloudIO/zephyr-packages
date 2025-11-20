import { execSync } from 'node:child_process';
import { getAllDeployedApps, getAppDeployResult, type DeployResult } from 'zephyr-agent';

const output = execSync(
  'npx nx show projects --affected -t=build --exclude="libs/*,e2e/*,packages/*"'
);
const testTargets = output.toString().split('\n').filter(Boolean);
const appUidsPromise: Promise<string[]> = getAllDeployedApps();

for (const appName of testTargets) {
  describe(`[${appName}]: asset deployment assertion`, () => {
    let deployResult: DeployResult;

    beforeAll(async () => {
      const appUids = await appUidsPromise;
      const appUid = appUids.find((uid) => uid.startsWith(replacer(appName)));
      if (!appUid) {
        throw new Error(`Application ${appName} was not found on deployed apps.`);
      }
      const result = await getAppDeployResult(appUid);
      if (!result) {
        throw new Error(`No deployment log found for application ${appName}.`);
      }
      deployResult = result;
    });

    it.skip(
      'should have correctly deployed assets',
      async () => {
        const url = deployResult.urls[0];
        const assetEntries = Object.values(deployResult.snapshot.assets);
        const promises = assetEntries.map(async (asset) => {
          return fetchWithRetries(`${url}/${asset.path}`, 3);
        });

        const results = await Promise.all(promises);
        results.forEach((res) => {
          expect(res.status).toBe(200);
          expect(res.ok).toBe(true);
        });
      },
      60 * 1000
    );
  });
}

const fetchWithRetries = async (url: string, attemptsLeft = 1) => {
  const res = await fetch(url, { method: 'HEAD' });

  if (res.status === 200 || attemptsLeft < 1) return res;

  await new Promise((resolve) => setTimeout(resolve, 5 * 1000));

  return fetchWithRetries(url, attemptsLeft - 1);
};

function replacer(str: string): string {
  return str.replace(/[^a-zA-Z0-9-]/gi, '-');
}
