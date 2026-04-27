const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const output = execFileSync(
  pnpm,
  [
    'exec',
    'turbo',
    'ls',
    '--affected',
    '--filter=./examples/**',
    '--output=json',
  ],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
);

const data = JSON.parse(output);
const items = (data.packages?.items ?? data.items ?? [])
  .map((pkg) => pkg.name)
  .filter((name) => name && name !== 'zephyr-cli-test');

const lines = [`has-targets=${items.length > 0}`, `targets=${items.join(' ')}`];

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

console.log(lines.join('\n'));
