import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const releaseTag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!releaseTag) {
  throw new Error('Release tag is required');
}

const rootManifest = JSON.parse(await readFile(path.join(workspaceRoot, 'package.json'), 'utf8'));
const expectedVersion = releaseTag.startsWith('v') ? releaseTag.slice(1) : releaseTag;
const errors = [];

if (rootManifest.version !== expectedVersion) {
  errors.push(`root version ${rootManifest.version} does not match release tag ${releaseTag}`);
}

const librariesRoot = path.join(workspaceRoot, 'libs');
let publishableCount = 0;
for (const entry of await readdir(librariesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifestFile = path.join(librariesRoot, entry.name, 'package.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  } catch {
    continue;
  }
  if (manifest.private) continue;
  publishableCount += 1;
  if (manifest.version !== expectedVersion) {
    errors.push(`${manifest.name} is ${manifest.version}, expected ${expectedVersion}`);
  }
}

if (errors.length > 0) {
  throw new Error(`Release version validation failed:\n- ${errors.join('\n- ')}`);
}

console.log(`Release ${releaseTag} matches ${publishableCount} publishable packages.`);
