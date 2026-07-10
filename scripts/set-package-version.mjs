import { randomUUID } from 'node:crypto';
import { readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SEMVER_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

async function getPublishableManifests(workspaceRoot) {
  const librariesRoot = path.join(workspaceRoot, 'libs');
  const manifests = [];

  for (const entry of await readdir(librariesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(librariesRoot, entry.name, 'package.json');
    let source;
    try {
      source = await readFile(file, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }

    const manifest = JSON.parse(source);
    if (manifest.private) continue;
    if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
      throw new Error(`${file} must define a package name and version`);
    }
    manifests.push({ file, manifest, source, mode: (await stat(file)).mode });
  }

  return manifests.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
}

export async function setPackageVersions(workspaceRoot, version) {
  if (!SEMVER_PATTERN.test(version ?? '')) {
    throw new Error(`Invalid package version: ${version ?? '<missing>'}`);
  }

  const manifests = await getPublishableManifests(workspaceRoot);
  if (manifests.length === 0) throw new Error('No publishable packages found');

  const updates = manifests
    .filter(({ manifest }) => manifest.version !== version)
    .map((entry) => ({
      ...entry,
      temporaryFile: `${entry.file}.${randomUUID()}.tmp`,
      updatedSource: `${JSON.stringify({ ...entry.manifest, version }, null, 2)}\n`,
    }));

  try {
    await Promise.all(
      updates.map(({ temporaryFile, updatedSource, mode }) =>
        writeFile(temporaryFile, updatedSource, { mode })
      )
    );
    for (const { file, temporaryFile } of updates) await rename(temporaryFile, file);
  } finally {
    await Promise.all(
      updates.map(({ temporaryFile }) => rm(temporaryFile, { force: true }).catch(() => {}))
    );
  }

  const invalid = [];
  for (const { file, manifest } of manifests) {
    const persisted = JSON.parse(await readFile(file, 'utf8'));
    if (persisted.version !== version) invalid.push(manifest.name);
  }
  if (invalid.length > 0) {
    throw new Error(`Version update did not persist for: ${invalid.join(', ')}`);
  }

  return { packageCount: manifests.length, updatedCount: updates.length };
}

async function main() {
  const version = process.argv[2];
  const workspaceRoot = path.resolve(import.meta.dirname, '..');
  const { packageCount, updatedCount } = await setPackageVersions(workspaceRoot, version);
  console.log(
    `Set ${packageCount} publishable package versions to ${version} (${updatedCount} changed).`
  );
}

const entryPoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (entryPoint === import.meta.url) await main();
