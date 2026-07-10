import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnCommand as spawn } from './run-command.mjs';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const pnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const productionEnv = {
  ...process.env,
  ZE_API: 'https://api.zephyr-cloud.io',
  ZE_API_GATE: 'https://zeapi.zephyrcloud.app',
  ZE_FAIL_BUILD: 'true',
  ZE_IS_PREVIEW: 'false',
};

const scenarios = {
  rspack: {
    packageName: 'sample-rspack-application',
    description: 'Rspack CSR',
    clean: ['examples/sample-rspack-application/dist'],
  },
  vite: {
    packageName: 'vite-react-ts',
    description: 'Vite 8 CSR',
    clean: ['examples/vite-react-ts/wwwroot'],
  },
  tanstack: {
    packageName: 'tanstack-start-basic-example',
    description: 'TanStack Start client + SSR',
    clean: ['examples/tanstack-start-basic/dist'],
  },
  vinext: {
    packageName: 'vinext-hackernews',
    description: 'Vinext RSC + SSR + client',
    clean: ['examples/vinext-hackernews/dist'],
  },
};

function parseArguments(args) {
  const options = {
    iterations: 3,
    output: undefined,
    prepare: true,
    selected: Object.keys(scenarios),
    list: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') {
      continue;
    } else if (argument === '--skip-prepare') {
      options.prepare = false;
    } else if (argument === '--list') {
      options.list = true;
    } else if (
      argument === '--iterations' ||
      argument === '--output' ||
      argument === '--scenario'
    ) {
      const value = args[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      index += 1;
      assignOption(options, argument.slice(2), value);
    } else if (argument.startsWith('--iterations=')) {
      assignOption(options, 'iterations', argument.slice('--iterations='.length));
    } else if (argument.startsWith('--output=')) {
      assignOption(options, 'output', argument.slice('--output='.length));
    } else if (argument.startsWith('--scenario=')) {
      assignOption(options, 'scenario', argument.slice('--scenario='.length));
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!Number.isInteger(options.iterations) || options.iterations < 1 || options.iterations > 20) {
    throw new Error('--iterations must be an integer between 1 and 20');
  }
  for (const name of options.selected) {
    if (!scenarios[name]) throw new Error(`Unknown benchmark scenario: ${name}`);
  }
  return options;
}

function assignOption(options, name, value) {
  if (name === 'iterations') {
    options.iterations = Number(value);
  } else if (name === 'output') {
    options.output = value;
  } else if (name === 'scenario') {
    options.selected = value === 'all' ? Object.keys(scenarios) : value.split(',').filter(Boolean);
  }
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parsePeakRss(stderr) {
  const macMatch = stderr.match(/^\s*(\d+)\s+maximum resident set size$/m);
  if (macMatch) return Number(macMatch[1]) / 1024 / 1024;
  const linuxMatch = stderr.match(/Maximum resident set size \(kbytes\):\s*(\d+)/);
  if (linuxMatch) return Number(linuxMatch[1]) / 1024;
  return undefined;
}

async function run(executable, args, options = {}) {
  const startedAt = process.hrtime.bigint();
  let stderr = '';
  const child = spawn(executable, args, {
    cwd: workspaceRoot,
    env: options.env ?? productionEnv,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false,
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    process.stderr.write(chunk);
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  if (exitCode !== 0) {
    throw new Error(`${executable} ${args.join(' ')} exited with code ${exitCode}`);
  }
  return { durationMs, peakRssMiB: parsePeakRss(stderr) };
}

async function runMeasuredBuild(packageName) {
  const commandArgs = ['--filter', packageName, 'run', 'build'];
  if (existsSync('/usr/bin/time') && process.platform === 'darwin') {
    return run('/usr/bin/time', ['-l', pnpmExecutable, ...commandArgs]);
  }
  if (existsSync('/usr/bin/time') && process.platform === 'linux') {
    return run('/usr/bin/time', ['-v', pnpmExecutable, ...commandArgs]);
  }
  return run(pnpmExecutable, commandArgs);
}

async function currentBranch() {
  let output = '';
  const child = spawn('git', ['branch', '--show-current'], {
    cwd: workspaceRoot,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  const branch = output.trim();
  if (exitCode !== 0 || !branch) {
    throw new Error('Production benchmarks require a named Git branch');
  }
  return branch;
}

const options = parseArguments(process.argv.slice(2));
if (options.list) {
  for (const [name, scenario] of Object.entries(scenarios)) {
    console.log(`${name}\t${scenario.packageName}\t${scenario.description}`);
  }
  process.exit(0);
}

const branch = await currentBranch();
if (options.prepare) {
  console.log('Building local Zephyr packages before benchmark timing...');
  await run(pnpmExecutable, ['build']);
}

const results = [];
for (const name of options.selected) {
  const scenario = scenarios[name];
  for (const outputPath of scenario.clean) {
    await rm(path.join(workspaceRoot, outputPath), { force: true, recursive: true });
  }

  const samples = [];
  for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
    console.log(`\n[${name}] production build ${iteration}/${options.iterations}`);
    const measurement = await runMeasuredBuild(scenario.packageName);
    samples.push({
      iteration,
      mode: iteration === 1 ? 'cold-output' : 'repeat',
      durationMs: round(measurement.durationMs),
      peakRssMiB: measurement.peakRssMiB === undefined ? undefined : round(measurement.peakRssMiB),
    });
  }

  const durations = samples.map(({ durationMs }) => durationMs);
  const memory = samples.map(({ peakRssMiB }) => peakRssMiB).filter((value) => value !== undefined);
  results.push({
    name,
    packageName: scenario.packageName,
    description: scenario.description,
    samples,
    summary: {
      minMs: Math.min(...durations),
      medianMs: percentile(durations, 50),
      p95Ms: percentile(durations, 95),
      maxPeakRssMiB: memory.length > 0 ? Math.max(...memory) : undefined,
    },
  });
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  branch,
  productionEndpoints: {
    api: productionEnv.ZE_API,
    gateway: productionEnv.ZE_API_GATE,
  },
  runtime: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
  },
  iterations: options.iterations,
  results,
};

console.log('\nBuild benchmark summary');
for (const result of results) {
  const memory = result.summary.maxPeakRssMiB;
  console.log(
    `${result.name}: median ${round(result.summary.medianMs / 1000)}s, p95 ${round(result.summary.p95Ms / 1000)}s${memory === undefined ? '' : `, peak ${memory} MiB`}`
  );
}

if (options.output) {
  const outputFile = path.resolve(workspaceRoot, options.output);
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${path.relative(workspaceRoot, outputFile)}`);
}
