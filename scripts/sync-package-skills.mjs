import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const sharedSkills = ['zephyr-core', 'zephyr-module-federation'];
// Published packages that are not build integrations. Every other published
// package must also ship a dedicated skill for its own setup.
export const packagesWithoutDedicatedSkill = [
  'with-zephyr',
  'zephyr-agent',
  'zephyr-edge-contract',
  'zephyr-native-cache',
  'zephyr-tap-runtime',
  'zephyr-xpack-internal',
];
export const workspaceRoot = path.resolve(import.meta.dirname, '..');
const generatedMarker = '.zephyr-generated';
const markerContent = 'Generated from zephyr-packages/skills. Edit the canonical guide.\n';

export function publishedPackages(root = workspaceRoot) {
  return readdirSync(path.join(root, 'libs'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, 'libs', entry.name))
    .filter((directory) => existsSync(path.join(directory, 'package.json')))
    .filter(
      (directory) => !JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8')).private
    )
    .sort();
}

export function syncPackageSkills(
  packageDirectory,
  sourceRoot = path.join(workspaceRoot, 'skills')
) {
  const manifest = JSON.parse(readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));
  if (manifest.private)
    throw new Error(`Do not generate distribution skills for private package ${manifest.name}`);
  if (
    !Array.isArray(manifest.files) ||
    !manifest.files.includes('skills') ||
    !Array.isArray(manifest.keywords) ||
    !manifest.keywords.includes('tanstack-intent')
  ) {
    throw new Error(
      `${manifest.name} must include skills in files and tanstack-intent in keywords`
    );
  }
  const skillsDirectory = path.join(packageDirectory, 'skills');
  if (existsSync(skillsDirectory) && lstatSync(skillsDirectory).isSymbolicLink()) {
    throw new Error(`Refusing to write through a symlinked skills directory: ${skillsDirectory}`);
  }
  for (const skill of sharedSkills) {
    const source = path.join(sourceRoot, skill);
    const destination = path.join(packageDirectory, 'skills', skill);
    if (!existsSync(path.join(source, 'SKILL.md')))
      throw new Error(`Missing canonical skill ${skill}`);
    if (existsSync(destination)) {
      const marker = path.join(destination, generatedMarker);
      if (
        lstatSync(destination).isSymbolicLink() ||
        !existsSync(marker) ||
        readFileSync(marker, 'utf8') !== markerContent
      ) {
        throw new Error(`Refusing to replace an authored skill directory: ${destination}`);
      }
      rmSync(destination, { recursive: true });
    }
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: true });
    writeFileSync(path.join(destination, generatedMarker), markerContent);
  }
  return manifest.name;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--all')) {
    throw new Error('Usage: node scripts/sync-package-skills.mjs [--all]');
  }
  const packages = args[0] === '--all' ? publishedPackages() : [process.cwd()];
  for (const directory of packages)
    console.log(`Prepared shared skills for ${syncPackageSkills(directory)}`);
}
