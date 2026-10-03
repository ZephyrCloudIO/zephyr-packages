// Run against a disposable create-zephyr-apps React/Vite project. No cloud upload.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = process.argv[2] && realpathSync(resolve(process.argv[2]));
const manifestPath = process.argv[3];
assert(manifestPath, 'Pass a manifest of live source captures');
assert(
  directory && directory !== workspace,
  'Pass a disposable generated React/Vite project directory'
);
const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
const appRequire = createRequire(join(directory, 'package.json'));
const { build } = await import(pathToFileURL(appRequire.resolve('vite')));
const { default: react } = await import(pathToFileURL(appRequire.resolve('@vitejs/plugin-react')));
const sdk = await import(pathToFileURL(join(workspace, 'libs/zephyr-agent/dist/index.mjs')));
const { createSnapshot } = await import(
  pathToFileURL(join(workspace, 'libs/zephyr-agent/dist/lib/transformers/ze-build-snapshot.mjs'))
);
const { withZephyr } = await import(
  pathToFileURL(join(workspace, 'libs/vite-plugin-zephyr/dist/index.mjs'))
);
const versions = [];
let buildNumber = 0;
const invocation = Date.now();
const engine = {
  application_uid: 'attribution-demo.local.example',
  applicationProperties: {
    name: 'attribution-demo',
    project: 'local',
    org: 'example',
    version: '0.0.0',
  },
  application_configuration: Promise.resolve({
    username: 'demo-deployer',
    email: 'deployer@example.invalid',
    EDGE_URL: 'https://example.invalid',
    DELIMITER: '-',
  }),
  npmProperties: JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')),
  gitProperties: {
    git: {
      name: git('config', 'user.name'),
      email: git('config', 'user.email'),
      branch: git('branch', '--show-current'),
      commit: git('rev-parse', 'HEAD'),
    },
  },
  env: { isCI: false, target: 'web' },
  builder: 'vite',
  buildProperties: { output: './dist' },
  federated_dependencies: [],
  zephyr_dependencies: {},
  hasActiveBuild: false,
  sourceContext: directory,
  async start_new_build() {
    this.hasActiveBuild = true;
    this.build_id = Promise.resolve(`${invocation}-${++buildNumber}`);
    this.snapshotId = this.build_id;
    this.sourceCapture = this.pendingSourceCapture ?? sdk.captureSource(directory);
    this.pendingSourceCapture = undefined;
  },
  async upload_assets({ assetsMap, mfConfig, mfConfigs, snapshotType, entrypoint }) {
    // Replace the network transport only; use the SDK's real snapshot transformer.
    const snapshot = await createSnapshot(this, {
      assets: assetsMap,
      mfConfig,
      mfConfigs,
      snapshotType,
      entrypoint,
    });
    assert.equal(snapshot.changeAttribution.status, 'captured');
    assert.equal(snapshot.changeAttribution.consistency, 'boundary-match');
    assert(Object.keys(snapshot.assets).some((file) => file.endsWith('.js')));
    versions.push(snapshot);
  },
  async build_finished() {
    this.hasActiveBuild = false;
    this.sourceCapture = undefined;
    this.pendingSourceCapture = undefined;
  },
  build_failed() {
    this.hasActiveBuild = false;
  },
};
const originalDefer = sdk.ZephyrEngine.defer_create;
sdk.ZephyrEngine.defer_create = () => ({
  zephyr_engine_defer: Promise.resolve(engine),
  zephyr_defer_create() {},
});
// Any accidental network request should fail this verification.
const originalFetch = globalThis.fetch;
const originalFailBuild = process.env.ZE_FAIL_BUILD;
process.env.ZE_FAIL_BUILD = 'true';
globalThis.fetch = async () => {
  throw new Error('Demo must not access the cloud');
};
async function buildVersion() {
  await build({
    root: directory,
    configFile: false,
    envFile: false,
    logLevel: 'warn',
    plugins: [react(), ...withZephyr()],
    build: { outDir: 'dist' },
  });
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const cases = [];
let previous;
for (const item of manifest.cases) {
  const record = sdk.loadSourceRecord(directory, item.sourceId);
  assert(record.dirty, 'Live cases must exercise dirty source');
  const file = record.files[item.file];
  assert(file, `Missing ${item.file}`);
  const lines = Buffer.from(file.content, 'base64').toString('utf8').split('\n');
  const line = lines.findIndex((text) => text.includes(item.text)) + 1;
  assert(line > 0, `Missing live edit ${item.name}`);
  const origin = file.attribution.find((range) => range.start <= line && range.end >= line)
    ?.origin ?? { kind: 'unknown', evidence: 'none' };
  assert.equal(origin.kind, item.kind);
  if (item.model) assert.equal(origin.model, item.model);
  if (item.effort) assert.equal(origin.reasoningEffort, item.effort);
  if (item.harness) assert.equal(origin.harness, item.harness);
  if (item.kind === 'ai') assert.equal(origin.promptInitiator?.id, 'Zackary Chapple');
  const difference = previous
    ? sdk.compareSourceRecords(directory, previous.id, record.id)
    : undefined;
  if (difference) assert(difference.sameCommit, 'Cases must share one commit');
  if (difference) {
    const change = difference.changes.find((value) => value.file === item.file);
    const added = change?.lines.find(
      (value) => value.operation === 'add' && value.text.includes(item.text)
    );
    assert(added, `Expected a real added line for ${item.name}`);
    assert.equal(added.origin.kind, item.kind);
    if (item.model) assert.equal(added.origin.model, item.model);
  }
  for (const earlier of cases) {
    const earlierFile = record.files[earlier.file];
    const retainedLine =
      Buffer.from(earlierFile.content, 'base64')
        .toString('utf8')
        .split('\n')
        .findIndex((value) => value.includes(earlier.text)) + 1;
    assert(retainedLine > 0, `Retain earlier contribution ${earlier.name}`);
    const retainedOrigin = earlierFile.attribution.find(
      (value) => value.start <= retainedLine && value.end >= retainedLine
    )?.origin ?? { kind: 'unknown' };
    assert.equal(retainedOrigin.kind, earlier.kind);
    if (earlier.model) assert.equal(retainedOrigin.model, earlier.model);
    if (earlier.effort) assert.equal(retainedOrigin.reasoningEffort, earlier.effort);
  }
  cases.push({
    ...item,
    fingerprint: record.fingerprint,
    workspaceHuman: record.workspaceHuman,
    observedOrigin: origin,
    sessions: record.sessions,
    difference,
  });
  previous = record;
}
try {
  await buildVersion();
} finally {
  sdk.ZephyrEngine.defer_create = originalDefer;
  globalThis.fetch = originalFetch;
  if (originalFailBuild === undefined) delete process.env.ZE_FAIL_BUILD;
  else process.env.ZE_FAIL_BUILD = originalFailBuild;
}
const report = {
  schemaVersion: 1,
  evidenceMode: 'live-harness-edits',
  generatedApp: directory,
  note: 'Cases are immutable dirty-source receipts, not cloud deployments. The final application was built with the real local Vite/SDK snapshot flow and transport disabled. Harness/initiator labels are integration self-reports. Session-cumulative usage/cost snapshots are not additive and are not allocated to lines. Grok tool-to-prompt association uses the observed active prompt because native tool events omit promptId.',
  baseCommit: git('rev-parse', 'HEAD'),
  cases,
  localBuild: {
    snapshotId: versions[0].snapshot_id,
    creator: versions[0].creator,
    assets: Object.keys(versions[0].assets),
    attribution: versions[0].changeAttribution,
  },
};
const reportPath = join(directory, '.git/zephyr-attribution/live-test-report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(
  JSON.stringify(
    {
      reportPath,
      cases: cases.map((item) => ({ name: item.name, origin: item.observedOrigin })),
      built: true,
    },
    null,
    2
  )
);
