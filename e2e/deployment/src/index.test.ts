import { beforeAll, describe, expect, it } from '@rstest/core';

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getAllDeployedApps, getAppDeployResult, type DeployResult } from 'zephyr-agent';

const output = execSync('pnpm exec turbo ls --affected --output=json');
const affected = JSON.parse(output.toString()) as {
  packages: { items: Array<{ name: string; path: string }> };
};
const testTargets = affected.packages.items
  .filter((pkg) => {
    const packagePath = pkg.path.replaceAll('\\', '/');
    if (!packagePath.startsWith('examples/') || pkg.name === 'zephyr-cli-test') {
      return false;
    }
    const packageFile = path.resolve(
      import.meta.dirname,
      '../../..',
      packagePath,
      'package.json'
    );
    const packageJson = JSON.parse(readFileSync(packageFile, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    return Boolean(packageJson.scripts?.build);
  })
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
        if (!url) {
          throw new Error(`Deployment ${appName} did not report an application URL.`);
        }
        const baseUrl = url.endsWith('/') ? url : `${url}/`;

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
        await mapWithConcurrency(assetEntries, 8, async (asset) => {
          const assetUrl = new URL(asset.path.replace(/^\/+/, ''), baseUrl).toString();
          await fetchWithRetries(assetUrl, 4);
        });
      },
      60 * 1000
    );
  });
}

async function fetchWithRetries(url: string, maxAttempts = 1): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return response;

      const retryable =
        response.status === 408 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500;
      const statusError = new Error(
        `HEAD ${url} returned ${response.status} ${response.statusText}`
      );
      if (!retryable) throw new NonRetryableResponseError(statusError.message);
      if (attempt === maxAttempts) throw statusError;
      lastError = statusError;
    } catch (error) {
      if (error instanceof NonRetryableResponseError) throw error;
      lastError = error;
      if (attempt === maxAttempts) break;
    }

    const exponentialDelay = Math.min(2_000, 200 * 2 ** (attempt - 1));
    const jitter = Math.floor(Math.random() * Math.max(1, exponentialDelay / 4));
    await new Promise((resolve) => setTimeout(resolve, exponentialDelay + jitter));
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Failed to fetch deployed asset ${url} after ${maxAttempts} attempts: ${detail}`,
    {
      cause: lastError,
    }
  );
}

class NonRetryableResponseError extends Error {}

async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await task(items[index]);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

function replacer(str: string): string {
  return str.replace(/[^a-zA-Z0-9-]/gi, '-').toLowerCase();
}
