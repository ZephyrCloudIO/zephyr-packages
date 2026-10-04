// Built SDK/CLI verification. Use a disposable repository with attribution enabled.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = process.argv[2] && realpathSync(resolve(process.argv[2]));
assert(directory && directory !== workspace, 'Pass a disposable generated app');
const sdk = await import(pathToFileURL(join(workspace, 'libs/zephyr-agent/dist/index.mjs')));
const { root, gitDir } = sdk.attributionRepository(directory);
const configPath = join(root, '.zephyr/attribution.json');
const originalConfig = readFileSync(configPath);
const localOverride = join(gitDir, 'zephyr-attribution/config.local.json');
assert(!existsSync(localOverride), 'Use a disposable app without a private override');
const markerPath = join(root, 'private-report-fixture.txt');
assert(!existsSync(markerPath), 'Use a disposable app without the report fixture');
const cli = join(workspace, 'libs/zephyr-cli/dist/index.mjs');
const run = (...args) =>
  execFileSync(process.execPath, [cli, 'attribution', ...args, '-C', root, '--format', 'json'], {
    encoding: 'utf8',
  });
let output;
try {
  writeFileSync(
    configPath,
    JSON.stringify({
      ...JSON.parse(originalConfig),
      storage: 'remote',
      content: { patch: true, lines: true },
    })
  );
  assert.equal(sdk.readAttributionConfig(root, gitDir).storage, 'local');
  const denied = spawnSync(
    process.execPath,
    [cli, 'attribution', 'configure', '-C', root, '--storage', 'remote'],
    { encoding: 'utf8' }
  );
  assert.notEqual(denied.status, 0);
  const legacy = readFileSync(configPath, 'utf8');
  run('configure', '--storage', 'local', '--local');
  assert.equal(readFileSync(configPath, 'utf8'), legacy);
  assert.equal(sdk.readAttributionConfig(root, gitDir).storage, 'local');
  rmSync(localOverride);
  run('configure', '--storage', 'local');
  assert.equal(JSON.parse(readFileSync(configPath)).storage, 'local');
  const before = sdk.captureSource(root).record.id;
  writeFileSync(markerPath, 'PRIVATE_SOURCE_MARKER\nsecond private line\n');
  const after = sdk.captureSource(root).record.id;
  ({ output } = JSON.parse(run('report', before, after)));
  const content = readFileSync(output, 'utf8');
  const report = JSON.parse(content);
  assert(output.startsWith(join(gitDir, 'zephyr-attribution')));
  assert.equal(statSync(output).mode & 0o777, 0o600);
  assert.equal(report.kind, 'zephyr-local-attribution-report');
  assert.equal(report.before, before);
  assert.equal(report.after, after);
  assert.equal(report.sameCommit, true);
  assert.deepEqual(report.files, { changed: 1, added: 1, modified: 0, deleted: 0, binary: 0 });
  assert.deepEqual(report.lines.added, { total: 2, human: 0, ai: 0, unknown: 2 });
  assert(!content.includes('PRIVATE_SOURCE_MARKER'));
  assert(!content.includes('private-report-fixture'));
  const overwrite = spawnSync(
    process.execPath,
    [cli, 'attribution', 'report', before, after, '-C', root, '--output', output],
    { encoding: 'utf8' }
  );
  assert.notEqual(overwrite.status, 0);
  assert.equal(readFileSync(output, 'utf8'), content);
  console.log(
    JSON.stringify(
      {
        passed: true,
        checks: [
          'legacy remote normalized locally',
          'remote CLI rejected',
          'built CLI exports aggregate report',
          'no paths or source in export',
          'private default permissions',
          'existing output not overwritten',
        ],
      },
      null,
      2
    )
  );
} finally {
  writeFileSync(configPath, originalConfig);
  rmSync(markerPath, { force: true });
  rmSync(localOverride, { force: true });
  if (output) rmSync(output, { force: true });
}
