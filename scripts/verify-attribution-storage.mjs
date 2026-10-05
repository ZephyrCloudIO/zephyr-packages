// Real HTTP client/fixture endpoint verification against a disposable generated app.
// This does not exercise production authorization, encrypted storage, or BYOC routing.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = process.argv[2] && realpathSync(resolve(process.argv[2]));
assert(directory && directory !== workspace, 'Pass a disposable generated app');
const sdk = await import(pathToFileURL(join(workspace, 'libs/zephyr-agent/dist/index.mjs')));
const { publishAttribution } = await import(
  pathToFileURL(join(workspace, 'libs/zephyr-agent/dist/lib/change-attribution/remote.mjs'))
);
const { root, gitDir } = sdk.attributionRepository(directory);
const configPath = join(root, '.zephyr/attribution.json');
const originalConfig = readFileSync(configPath);
const localOverride = join(gitDir, 'zephyr-attribution/config.local.json');
assert(!existsSync(localOverride), 'Use a disposable app without a private override');
const environmentKeys = ['ZE_API_GATE', 'ZE_API', 'ZE_SECRET_TOKEN', 'ZE_IS_PREVIEW'];
const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]])
);
const requests = [];
const cases = [];
let responseMode = 'ok';
let redirectHits = 0;
const server = createServer(async (request, response) => {
  if (request.url === '/redirect-target') {
    redirectHits++;
    response.end();
    return;
  }
  assert.equal(request.url, '/attribution');
  assert.equal(request.headers.authorization, 'Bearer attribution-test-fixture');
  assert.match(request.headers['idempotency-key'], /^[a-f0-9]{64}$/);
  let body = '';
  for await (const chunk of request) body += chunk;
  const payload = JSON.parse(body);
  requests.push({ payload, key: request.headers['idempotency-key'] });
  if (responseMode === 'redirect') {
    response.writeHead(302, { location: '/redirect-target' });
    response.end();
    return;
  }
  response.setHeader('content-type', 'application/json');
  response.end(
    JSON.stringify({
      status: 'ok',
      recordId: `record-${requests.length}`,
      applicationUid: payload.applicationUid,
      repositoryId: responseMode === 'mismatch' ? 'wrong-repo' : payload.repositoryId,
      buildId: payload.buildId,
      snapshotId: payload.snapshotId,
      sourceFingerprint: payload.attribution.sourceFingerprint,
    })
  );
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const endpoint = `http://127.0.0.1:${server.address().port}`;
process.env.ZE_API_GATE = endpoint;
process.env.ZE_API = endpoint;
process.env.ZE_SECRET_TOKEN = 'attribution-test-fixture';
process.env.ZE_IS_PREVIEW = 'false';
const invocation = Date.now();
try {
  const cli = join(workspace, 'libs/zephyr-cli/dist/index.mjs');
  const configure = (...args) =>
    execFileSync(process.execPath, [cli, 'attribution', 'configure', '-C', root, ...args], {
      encoding: 'utf8',
    });
  configure('--storage', 'remote', '--patches', 'include', '--lines', 'omit');
  const shared = readFileSync(configPath, 'utf8');
  assert.equal(JSON.parse(shared).storage, 'remote');
  configure('--storage', 'local', '--local');
  assert.equal(readFileSync(configPath, 'utf8'), shared);
  assert.equal(sdk.readAttributionConfig(root, gitDir).storage, 'local');
  const denied = spawnSync(
    process.execPath,
    [cli, 'attribution', 'configure', '-C', root, '--storage', 'remote', '--local'],
    { encoding: 'utf8' }
  );
  assert.notEqual(denied.status, 0, 'Private override must not escalate sharing');
  rmSync(localOverride);
  for (const item of [
    { name: 'local-free', storage: 'local', tier: 'free' },
    { name: 'remote-free', storage: 'remote', tier: 'free' },
    { name: 'remote-paid-metadata', storage: 'remote', tier: 'paid' },
    {
      name: 'remote-paid-patch',
      storage: 'remote',
      tier: 'paid',
      content: { patch: true, lines: false },
    },
    {
      name: 'remote-byoc-lines',
      storage: 'remote',
      tier: 'byoc',
      content: { patch: false, lines: true },
    },
  ]) {
    sdk.writeAttributionConfig(root, gitDir, {
      ...JSON.parse(originalConfig),
      storage: item.storage,
      content: item.content,
    });
    const buildId = `storage-${invocation}-${item.name}`;
    const snapshotId = `${buildId}.demo.example.invalid`;
    const summary = sdk.finishSourceCapture(
      root,
      sdk.captureSource(root, 'build-start'),
      snapshotId
    );
    const before = requests.length;
    const arguments_ = {
      directory: root,
      summary,
      applicationUid: 'app.demo.example',
      buildId,
      snapshotId,
      appConfig: {
        application_uid: 'app.demo.example',
        ATTRIBUTION_POLICY: {
          schemaVersion: 1,
          repositoryId: 'demo-repo',
          revision: 'policy-v1',
          storage: 'remote',
          tier: item.tier,
          content: { patch: true, lines: true },
        },
      },
    };
    const reference = await publishAttribution(arguments_);
    if (item.storage === 'local') {
      assert.equal(reference, undefined);
      assert.equal(requests.length, before);
    } else {
      const sent = requests.at(-1).payload;
      assert.equal(requests.length, before + 1);
      assert.equal(sent.buildId, buildId);
      assert.equal(sent.snapshotId, snapshotId);
      assert.equal(sent.repositoryId, 'demo-repo');
      assert.equal(sent.attribution.sourceFingerprint, summary.sourceFingerprint);
      assert(!('files' in reference));
      assert(!('sessions' in reference));
      assert(Object.values(sent.attribution.files).every((file) => !('content' in file)));
      if (item.name === 'remote-paid-metadata') {
        assert(!('comparison' in sent));
        assert.deepEqual(sent.content, { patch: false, lines: false });
      } else {
        assert.equal(sent.comparison.base, 'git-head');
        assert(sent.comparison.changes.some((change) => change.file.startsWith('src/')));
        for (const change of sent.comparison.changes) {
          assert.equal('patch' in change, item.tier === 'free' || Boolean(item.content?.patch));
          assert.equal('lines' in change, item.tier === 'free' || Boolean(item.content?.lines));
        }
      }
      if (item.name === 'remote-free') {
        const retryKey = requests.at(-1).key;
        await publishAttribution(arguments_);
        assert.equal(requests.at(-1).key, retryKey, 'Retry must retain repository/build identity');
      }
    }
    cases.push({
      ...item,
      buildId,
      snapshotId,
      sourceFingerprint: summary.sourceFingerprint,
      reference,
      passed: true,
    });
  }
  const last = cases.at(-1);
  const summary = sdk.loadVersionAttribution(root, last.snapshotId);
  const negative = {
    directory: root,
    summary,
    applicationUid: 'app.demo.example',
    buildId: last.buildId,
    snapshotId: last.snapshotId,
    appConfig: {
      application_uid: 'app.demo.example',
      ATTRIBUTION_POLICY: {
        schemaVersion: 1,
        repositoryId: 'demo-repo',
        revision: 'policy-v1',
        storage: 'remote',
        tier: 'byoc',
        content: { patch: true, lines: true },
      },
    },
  };
  responseMode = 'mismatch';
  await assert.rejects(publishAttribution(negative), /not acknowledged/);
  responseMode = 'redirect';
  await assert.rejects(publishAttribution(negative), /not acknowledged/);
  assert.equal(redirectHits, 0, 'Evidence/credentials must not follow a redirect');
  const report = {
    evidenceMode: 'built-sdk-local-http-fixture',
    note: 'Real authenticated-request construction with a fixture credential and local endpoint; not production authorization, billing enforcement, encrypted server persistence, or BYOC routing.',
    cases,
    negativeChecks: [
      'built CLI preserves shared config while restricting storage privately',
      'private remote escalation rejected',
      'mismatched repository acknowledgment rejected',
      'redirect rejected',
      'same-build retry retains idempotency key',
    ],
    requestCount: requests.length,
  };
  const reportPath = join(gitDir, 'zephyr-attribution/storage-test-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(
    JSON.stringify(
      {
        reportPath,
        cases: cases.map(({ name, passed }) => ({ name, passed })),
        negativeChecks: report.negativeChecks,
      },
      null,
      2
    )
  );
} finally {
  writeFileSync(configPath, originalConfig);
  rmSync(localOverride, { force: true });
  for (const key of environmentKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
  await new Promise((resolve) => server.close(resolve));
}
