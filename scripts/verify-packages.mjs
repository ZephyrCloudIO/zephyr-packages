import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { execCommandSync } from './run-command.mjs';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const librariesRoot = path.join(workspaceRoot, 'libs');
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const errors = [];
const reports = [];

function run(executable, args, cwd) {
  return execCommandSync(executable, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function collectTargets(value, targets) {
  if (typeof value === 'string') {
    if (!value.includes('*')) targets.add(value.replace(/^\.\//, ''));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTargets(item, targets);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectTargets(item, targets);
  }
}

function conditionTarget(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  return value.default ?? value.types;
}

function verifyArchive(packageRoot, manifest, report) {
  const files = new Set(report.files.map(({ path: file }) => file.replaceAll('\\', '/')));
  const packageErrors = [];

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    packageErrors.push('manifest must use an explicit files allowlist');
  }

  for (const file of files) {
    const basename = path.posix.basename(file);
    const nativeSource = manifest.name === 'zephyr-native-cache' && file.startsWith('src/');
    if (
      file.startsWith('.turbo/') ||
      file.endsWith('.tsbuildinfo') ||
      /(^|\/)rslib\.config\./.test(file) ||
      /(^|\/)rstest\.config\./.test(file) ||
      /(^|\/)tsconfig(?:\.|$)/.test(file) ||
      /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) ||
      file.endsWith('.map') ||
      (!nativeSource && file.startsWith('src/')) ||
      (!nativeSource && /(?<!\.d)\.[cm]?tsx?$/.test(file)) ||
      /^\.env(?:\.|$)/.test(basename) ||
      basename === '.npmrc' ||
      /\.(?:pem|key|p12|pfx)$/i.test(basename) ||
      /^(?:credentials?|secrets?)(?:\.|$)/i.test(basename)
    ) {
      packageErrors.push(`forbidden archive entry: ${file}`);
    }
  }

  const targets = new Set();
  for (const field of ['main', 'module', 'types', 'bin', 'exports']) {
    collectTargets(manifest[field], targets);
  }
  for (const target of targets) {
    if (!files.has(target)) {
      packageErrors.push(`manifest target is absent from archive: ${target}`);
    }
  }

  if (manifest.module) {
    const rootExport = manifest.exports?.['.'];
    const importTarget = conditionTarget(rootExport?.import);
    const requireTarget = conditionTarget(rootExport?.require);
    if (!importTarget || !requireTarget) {
      packageErrors.push('dual-format package must expose both import and require targets');
    }
  }

  if (packageErrors.length > 0) {
    for (const error of packageErrors) errors.push(`${manifest.name}: ${error}`);
    return;
  }

  const smokeEligible =
    manifest.module && manifest.name !== 'zephyr-native-cache' && manifest.name !== 'zephyr-cli';
  if (smokeEligible) {
    try {
      run(
        process.execPath,
        ['-e', `require(${JSON.stringify(`./${manifest.main}`)})`],
        packageRoot
      );
      run(
        process.execPath,
        ['--input-type=module', '-e', `await import(${JSON.stringify(`./${manifest.module}`)})`],
        packageRoot
      );
    } catch (error) {
      const detail = error?.stderr?.toString().trim() || error.message;
      errors.push(`${manifest.name}: import/require smoke failed: ${detail}`);
    }
  }
}

for (const entry of readdirSync(librariesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const packageRoot = path.join(librariesRoot, entry.name);
  const manifestFile = path.join(packageRoot, 'package.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  } catch {
    continue;
  }
  if (manifest.private) continue;

  try {
    const packed = JSON.parse(
      run(npmExecutable, ['pack', '--ignore-scripts', '--json', '--dry-run'], packageRoot)
    );
    const report = packed[0];
    if (!report || !Array.isArray(report.files)) {
      errors.push(`${manifest.name}: npm pack did not return a file inventory`);
      continue;
    }
    verifyArchive(packageRoot, manifest, report);
    reports.push({
      name: manifest.name,
      version: manifest.version,
      files: report.files.length,
      size: report.size,
    });
  } catch (error) {
    const detail = error?.stderr?.toString().trim() || error.message;
    errors.push(`${manifest.name}: npm pack failed: ${detail}`);
  }
}

const versions = new Set(reports.map(({ version }) => version));
if (versions.size > 1) {
  errors.push(`publishable package versions differ: ${[...versions].sort().join(', ')}`);
}

if (errors.length > 0) {
  console.error(`Package verification failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const totalFiles = reports.reduce((total, report) => total + report.files, 0);
  const totalBytes = reports.reduce((total, report) => total + report.size, 0);
  console.log(
    `Verified ${reports.length} publishable packages (${totalFiles} files, ${totalBytes} packed bytes).`
  );
}
