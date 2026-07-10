import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execCommand } from './run-command.mjs';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const librariesRoot = path.join(workspaceRoot, 'libs');
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

async function getPublishablePackageNames() {
  const names = [];
  for (const entry of await readdir(librariesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestFile = path.join(librariesRoot, entry.name, 'package.json');
    let manifest;
    try {
      manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    } catch {
      continue;
    }
    if (!manifest.private && typeof manifest.name === 'string') names.push(manifest.name);
  }
  return names.sort();
}

async function getDistTags(packageName) {
  try {
    const { stdout } = await execCommand(
      npmExecutable,
      ['view', packageName, 'dist-tags', '--json'],
      { cwd: workspaceRoot, timeout: 30_000, maxBuffer: 1024 * 1024 }
    );
    return stdout.trim() ? JSON.parse(stdout) : {};
  } catch (error) {
    const detail = `${error?.stderr ?? ''}\n${error?.stdout ?? ''}`;
    if (/E404|404 Not Found/i.test(detail)) return {};
    throw new Error(`Unable to read npm dist-tags for ${packageName}`, { cause: error });
  }
}

async function mapWithConcurrency(items, concurrency, task) {
  const results = Array.from({ length: items.length });
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export function selectNextPrereleaseVersion(packageNames, distTags, tag, baseVersion) {
  const prefix = `${baseVersion}-${tag}.`;
  const matchingVersions = [];

  for (let index = 0; index < packageNames.length; index += 1) {
    const packageName = packageNames[index];
    const version = distTags[index]?.[tag];
    if (typeof version !== 'string' || !version.startsWith(prefix)) continue;
    const suffix = version.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) {
      throw new Error(`${packageName} has an invalid ${tag} version: ${version}`);
    }
    const parsedSuffix = Number.parseInt(suffix, 10);
    if (!Number.isSafeInteger(parsedSuffix)) {
      throw new Error(`${packageName} has an unsafe ${tag} version: ${version}`);
    }
    matchingVersions.push({ packageName, suffix: parsedSuffix, version });
  }

  if (matchingVersions.length === 0) return `${prefix}1`;

  const highest = Math.max(...matchingVersions.map(({ suffix }) => suffix));
  const highestVersion = `${prefix}${highest}`;
  const packagesAtHighest = matchingVersions.filter(
    ({ version }) => version === highestVersion
  ).length;

  // Publishing is intentionally sequential and restart-safe. If only a subset reached the
  // highest version, reuse it so pnpm skips the packages already present on npm and resumes
  // the remainder. Advance only after every publishable package converged on that version.
  return packagesAtHighest === packageNames.length ? `${prefix}${highest + 1}` : highestVersion;
}

async function main() {
  const [tag, baseVersion] = process.argv.slice(2);
  if (!tag || !/^[a-z0-9][a-z0-9._-]*$/i.test(tag)) {
    throw new Error('Usage: next-prerelease-version.mjs <dist-tag> <base-version>');
  }
  if (!baseVersion || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(baseVersion)) {
    throw new Error(`Invalid base version: ${baseVersion ?? '<missing>'}`);
  }

  const packageNames = await getPublishablePackageNames();
  if (packageNames.length === 0) throw new Error('No publishable packages found');

  const packageDistTags = await mapWithConcurrency(packageNames, 6, getDistTags);
  const nextVersion = selectNextPrereleaseVersion(packageNames, packageDistTags, tag, baseVersion);
  const packagesAlreadyPublished = packageDistTags.filter(
    (tags) => tags?.[tag] === nextVersion
  ).length;

  console.error(
    packagesAlreadyPublished > 0
      ? `Resuming ${nextVersion}; ${packagesAlreadyPublished}/${packageNames.length} packages already published.`
      : `Inspected ${packageNames.length} npm packages; selected ${nextVersion}.`
  );
  process.stdout.write(nextVersion);
}

const entryPoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (entryPoint === import.meta.url) await main();
