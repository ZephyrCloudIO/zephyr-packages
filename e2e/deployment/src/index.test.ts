import { execSync } from 'node:child_process';
import {
  getAllDeployedApps,
  getAppDeployResult,
  type DeployResult,
} from 'zephyr-agent';

const output = execSync(
  'pnpm exec turbo ls --filter=./examples/** --output=json',
  {
    encoding: 'utf8',
  }
);

const turboLs = JSON.parse(output) as {
  packages?: { items?: Array<{ name?: string }> };
  items?: Array<{ name?: string }>;
};

const testTargets = (
  turboLs.packages?.items?.map((pkg) => pkg.name) ??
  turboLs.items?.map((pkg) => pkg.name) ??
  []
).filter((name): name is string => Boolean(name) && name !== 'zephyr-cli-test');
const appUidsPromise: Promise<string[]> = getAllDeployedApps();
const isCI = process.env.CI === 'true';

for (const appName of testTargets) {
  describe(`[${appName}]: asset deployment assertion`, () => {
    let deployResult: DeployResult | undefined;
    let hasDeploymentCache = true;

    beforeAll(async () => {
      const appUids = await appUidsPromise;
      if (appUids.length === 0 && !isCI) {
        hasDeploymentCache = false;
        return;
      }

      const appUid = appUids.find((uid) => uid.startsWith(replacer(appName)));
      if (!appUid) {
        if (!isCI) {
          hasDeploymentCache = false;
          return;
        }

        throw new Error(
          `Application ${appName} was not found on deployed apps.`
        );
      }
      const result = await getAppDeployResult(appUid);
      if (!result) {
        if (!isCI) {
          hasDeploymentCache = false;
          return;
        }

        throw new Error(`No deployment log found for application ${appName}.`);
      }
      deployResult = result;
    });

    it(
      'should have correctly deployed assets',
      async () => {
        if (!hasDeploymentCache) {
          return;
        }

        if (!deployResult) {
          throw new Error(
            `No deployment log loaded for application ${appName}.`
          );
        }

        const url = deployResult.urls[0];

        // TODO: when SSR gets stable, come back here to validate asset deployment
        if (deployResult.snapshot.type === 'ssr') {
          console.log(
            'Skipping asset check for SSR app. Verifying index page response only.'
          );
          const res = await fetchWithRetries(url, 3);
          expect(res.status).toBe(200);
          expect(res.ok).toBe(true);
          return;
        }
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
  return str.replace(/[^a-zA-Z0-9-]/gi, '-').toLowerCase();
}
