import { exec as execCB } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { getAllDeployedApps } from 'zephyr-agent';

const exec = promisify(execCB);

export default async function globalSetup() {
  console.log('\n - Global Setup - Setting up test cases\n');
  const output = await exec('npx nx show projects --t=build --exclude libs/*');
  const examples = output.stdout.split('\n').filter(Boolean);
  const deployedApps = await getAllDeployedApps();
  const testTargets = deployedApps.filter((appUid) =>
    examples.includes(appUid.split('.')[0])
  );

  writeFileSync('./test-targets.json', JSON.stringify(testTargets));
}
