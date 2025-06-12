import { exec as execCB } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { type DeployResult, getAppDeployResult, getGitInfo } from 'zephyr-agent';
import { createApplicationUid } from 'zephyr-edge-contract';
import { buildResultsPath } from './constants';

type DeployResults = Record<string, DeployResult | string | undefined>;

const prom = promisify(execCB);

const exec = async (cmd: string) => {
  console.log('Running command: ', cmd);
  return prom(cmd);
};

export default async function globalSetup() {
  console.log('Setting up tests');
  const gitInfo = await getGitInfo();
  let output = await exec('npx nx show projects --t=build --exclude libs/*');
  const examples = output.stdout.split('\n').filter(Boolean);
  const results: DeployResults = {};
  let appUid = '';

  for (const example of examples) {
    appUid = createApplicationUid({ ...gitInfo.app, name: example });
    let deployResult = await getAppDeployResult(appUid);

    if (deployResult) {
      results[example] = deployResult;
      continue;
    }

    output = await exec(`npx nx run ${example}:build`);

    if (output.stderr) {
      results[example] = output.stderr;
      continue;
    }

    deployResult = await getAppDeployResult(appUid);
    results[example] = deployResult;
  }

  const failedBuilds = Object.entries(results).filter(
    ([, result]) => typeof result === 'string' || result === undefined
  );

  if (failedBuilds.length) {
    console.log('The following builds have failed: ');
    failedBuilds.forEach(([appName, stderr]) => {
      console.log('Application: ', appName);
      console.log(' - stderr: ', stderr ?? 'Unknown issue');
    });
    process.exit(1);
  }

  writeFileSync(buildResultsPath, JSON.stringify(results));
}
