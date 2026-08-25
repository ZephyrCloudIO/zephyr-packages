import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function versionedLibraryFiles() {
  const packageFiles = readdirSync('libs', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join('libs', entry.name, 'package.json'))
    .filter(existsSync);
  const pluginFiles = [
    'libs/create-zephyr-apps/.codex-plugin/plugin.json',
    'libs/create-zephyr-apps/.claude-plugin/plugin.json',
    'libs/create-zephyr-apps/.cursor-plugin/plugin.json',
  ];
  return [...packageFiles, ...pluginFiles].sort();
}

test('tracks every versioned package and plugin manifest', () => {
  const config = readJson('release-please-config.json');
  const configuredFiles = [...config.packages['.']['extra-files']].sort();
  assert.deepEqual(configuredFiles, versionedLibraryFiles());
});

test('starts from the current synchronized release version', () => {
  const rootVersion = readJson('package.json').version;
  const manifestVersion = readJson('.release-please-manifest.json')['.'];
  assert.equal(manifestVersion, rootVersion);

  for (const path of versionedLibraryFiles()) {
    assert.equal(readJson(path).version, rootVersion, path);
  }
});
