// Run against a disposable create-zephyr-apps React/Vite project. No cloud upload.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = process.argv[2] && realpathSync(resolve(process.argv[2]));
const gitAi = process.argv[3] ?? 'git-ai';
assert(
  directory && directory !== workspace,
  'Pass a disposable generated React/Vite project directory'
);
const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
const initial = execFileSync('git', ['show', 'HEAD:src/App.tsx'], {
  cwd: directory,
  encoding: 'utf8',
});
assert(initial.includes('title="React + Vite"'), 'Expected the generated React/Vite template');
assert.match(execFileSync(gitAi, ['--version'], { encoding: 'utf8' }), /^1\.7\./);
const config = JSON.parse(readFileSync(join(directory, '.zephyr/attribution.json'), 'utf8'));
assert.equal(config.enabled, true, 'Run the codemod with --attribution first');

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
function checkpoint(preset, data) {
  execFileSync(gitAi, ['checkpoint', preset, '--hook-input', 'stdin'], {
    cwd: directory,
    input: JSON.stringify(data),
    encoding: 'utf8',
    timeout: 10000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
async function waitForAttribution(file, kind) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const capture = sdk.captureSource(directory);
    if (capture?.record?.files[file]?.attribution.some((range) => range.origin.kind === kind))
      return;
    await setTimeout(100);
  }
  throw new Error(`Git AI did not record ${kind} evidence for ${file}`);
}
try {
  const humanFixture = join(directory, 'src/attribution-example.txt');
  if (existsSync(humanFixture)) {
    assert.equal(
      readFileSync(humanFixture, 'utf8'),
      'Known human editor-event fixture\n',
      'Refusing to overwrite an existing non-fixture file'
    );
    rmSync(humanFixture);
  }
  writeFileSync(join(directory, 'src/App.tsx'), initial);
  await buildVersion();
  const payload = {
    session_id: `zephyr-demo-hook-replay-${invocation}`,
    model: 'gpt-6.1-sol',
    cwd: directory,
    tool_name: 'apply_patch',
    tool_use_id: 'demo-edit-1',
    tool_input: {
      input:
        '*** Begin Patch\n*** Update File: src/App.tsx\n@@\n-      title="React + Vite"\n+      title="React + Change Attribution"\n*** End Patch',
    },
  };
  checkpoint('codex', { ...payload, hook_event_name: 'PreToolUse' });
  writeFileSync(
    join(directory, 'src/App.tsx'),
    initial.replace('title="React + Vite"', 'title="React + Change Attribution"')
  );
  checkpoint('codex', {
    ...payload,
    hook_event_name: 'PostToolUse',
    tool_response: { output: 'M src/App.tsx' },
  });
  await waitForAttribution('src/App.tsx', 'ai');
  await buildVersion();
  // This is an editor-event replay, not a claim that a human typed this fixture.
  writeFileSync(
    join(directory, 'src/attribution-example.txt'),
    'Known human editor-event fixture\n'
  );
  checkpoint('known_human', {
    cwd: directory,
    editor: 'zephyr-demo-fixture',
    editor_version: 'test',
    extension_version: 'test',
    edited_filepaths: ['src/attribution-example.txt'],
  });
  await waitForAttribution('src/attribution-example.txt', 'human');
  writeFileSync(
    join(directory, 'src/App.tsx'),
    readFileSync(join(directory, 'src/App.tsx'), 'utf8') + '\n// Uninstrumented fixture edit\n'
  );
  await buildVersion();
  const aiDiff = sdk.compareSourceRecords(
    directory,
    versions[0].snapshot_id,
    versions[1].snapshot_id
  );
  const mixedDiff = sdk.compareSourceRecords(
    directory,
    versions[1].snapshot_id,
    versions[2].snapshot_id
  );
  assert(aiDiff.sameCommit && mixedDiff.sameCommit);
  assert(
    aiDiff.changes
      .flatMap((file) => file.lines)
      .some(
        (line) =>
          line.origin.kind === 'ai' &&
          line.origin.tool === 'codex' &&
          line.origin.model === 'gpt-6.1-sol'
      )
  );
  assert(
    mixedDiff.changes.flatMap((file) => file.lines).some((line) => line.origin.kind === 'human')
  );
  assert(
    mixedDiff.changes.flatMap((file) => file.lines).some((line) => line.origin.kind === 'unknown')
  );
  const report = {
    evidenceMode: 'replayed Codex and editor hook fixtures; cloud transport disabled',
    gitAiVersion: execFileSync(gitAi, ['--version'], { encoding: 'utf8' }).trim(),
    directory,
    versions: versions.map(({ snapshot_id, creator, changeAttribution, assets }) => ({
      version: snapshot_id,
      deployer: creator,
      attribution: changeAttribution,
      assetCount: Object.keys(assets).length,
    })),
    aiDiff,
    mixedDiff,
  };
  const reportPath = join(
    git('rev-parse', '--absolute-git-dir'),
    'zephyr-attribution/demo-report.json'
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(
    JSON.stringify(
      {
        status: 'pass',
        directory,
        reportPath,
        versions: versions.map((value) => value.snapshot_id),
        sameCommit: true,
        origins: ['ai: codex / gpt-6.1-sol (hook replay)', 'human (editor replay)', 'unknown'],
      },
      null,
      2
    )
  );
} finally {
  sdk.ZephyrEngine.defer_create = originalDefer;
  globalThis.fetch = originalFetch;
  if (originalFailBuild === undefined) delete process.env.ZE_FAIL_BUILD;
  else process.env.ZE_FAIL_BUILD = originalFailBuild;
}
