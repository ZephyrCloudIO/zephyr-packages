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
  const configuredFiles = config.packages['.']['extra-files'].map(({ path }) => path).sort();
  assert.deepEqual(configuredFiles, versionedLibraryFiles());
});

test('uses the native GitHub changelog renderer', () => {
  const config = readJson('release-please-config.json');
  assert.equal(config['changelog-type'], 'github');
});

test('uses explicit JSON version updaters for every manifest', () => {
  const config = readJson('release-please-config.json');
  for (const extraFile of config.packages['.']['extra-files']) {
    assert.equal(extraFile.type, 'json', extraFile.path);
    assert.equal(extraFile.jsonpath, '$.version', extraFile.path);
  }
});

test('starts from the current synchronized release version', () => {
  const rootVersion = readJson('package.json').version;
  const manifestVersion = readJson('.release-please-manifest.json')['.'];
  assert.equal(manifestVersion, rootVersion);

  for (const path of versionedLibraryFiles()) {
    assert.equal(readJson(path).version, rootVersion, path);
  }
});

test('gates Release Please on the package audit', () => {
  const workflow = readFileSync('.github/workflows/release-please.yml', 'utf8');
  const integrityJob = workflow.indexOf('\n  verify-package-integrity:');
  const releaseJob = workflow.indexOf('\n  release-please:');

  assert.ok(integrityJob > 0, 'package integrity job is missing');
  assert.ok(releaseJob > integrityJob, 'Release Please must run after the package integrity job');
  assert.match(
    workflow.slice(integrityJob, releaseJob),
    /run: pnpm audit --audit-level high/,
    'package integrity job must run the high-severity audit'
  );
  assert.match(
    workflow.slice(releaseJob),
    /needs: verify-package-integrity/,
    'Release Please must depend on the package integrity job'
  );
});
