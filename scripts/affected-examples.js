const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const output = execFileSync(
  process.execPath,
  [
    require.resolve('turbo/bin/turbo'),
    'ls',
    '--affected',
    '--filter=./examples/**',
    '--output=json',
  ],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
);

const jsonStart = output.indexOf('{');
if (jsonStart === -1) {
  throw new Error(`Expected Turbo JSON output, received: ${output}`);
}

const data = JSON.parse(output.slice(jsonStart));
const items = (data.packages?.items ?? data.items ?? [])
  .map((pkg) => pkg.name)
  .filter((name) => name && name !== 'zephyr-cli-test');

const lines = [`has-targets=${items.length > 0}`, `targets=${items.join(' ')}`];

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

console.log(lines.join('\n'));
