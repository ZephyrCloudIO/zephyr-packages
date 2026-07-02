import { execSync } from 'node:child_process';
import { getAllDeployedApps, getAppDeployResult, type DeployResult } from 'zephyr-agent';

// The example apps CI builds and deploys to Zephyr on pull requests.
// Keep in sync with the "run build examples" step in .github/workflows/on_pull_request.yml.
const CI_DEPLOYED_EXAMPLES = new Set([
  'sample-webpack-application',
  'sample-rspack-application',
  'rollup-sample-lib',
  'team-red',
  'team-green',
  'team-blue',
  'rspack_mf_host',
  'rspack_mf_remote',
  'rspack_nx_mf_host',
  'rspack_nx_mf_remote',
]);

const output = execSync('pnpm exec turbo ls --affected --output=json');
const affected = JSON.parse(output.toString()) as {
  packages: { items: Array<{ name: string; path: string }> };
};
const testTargets = affected.packages.items
  .filter((pkg) => pkg.path.startsWith('examples/') && CI_DEPLOYED_EXAMPLES.has(pkg.name))
  .map((pkg) => pkg.name);

if (testTargets.length === 0) {
  it('has no affected example deployment tests to run', () => {
    expect(testTargets).toHaveLength(0);
  });
}

let appUidsPromise: Promise<string[]> | undefined;

for (const appName of testTargets) {
  describe(`[${appName}]: asset deployment assertion`, () => {
    let deployResult: DeployResult;

    beforeAll(async () => {
      appUidsPromise ??= getAllDeployedApps();
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

    it(
      'should have correctly deployed assets',
      async () => {
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
