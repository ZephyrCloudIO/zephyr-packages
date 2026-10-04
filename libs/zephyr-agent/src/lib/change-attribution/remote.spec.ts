import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AttributionRepositoryPolicy } from 'zephyr-edge-contract';
import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';
const mocks = rs.hoisted(() => ({ token: rs.fn(), request: rs.fn() }));
rs.mock('../node-persist/token', () => ({ getToken: mocks.token }));
rs.mock('../http/http-request', () => ({ makeRequest: mocks.request }));
import { captureSource, finishSourceCapture, loadSourceRecord } from './source';
import { readAttributionConfig, writeAttributionConfig } from './config';
import { publishAttribution } from './remote';

describe('local and remote attribution', () => {
  let root: string;
  let gitDir: string;
  const policy = (
    tier: AttributionRepositoryPolicy['tier'] = 'paid'
  ): AttributionRepositoryPolicy => ({
    schemaVersion: 1,
    repositoryId: 'repo-1',
    revision: 'revision-1',
    storage: 'remote',
    tier,
    content: { patch: true, lines: true },
  });
  beforeEach(() => {
    rs.clearAllMocks();
    root = mkdtempSync(join(tmpdir(), 'zephyr-remote-'));
    gitDir = join(root, '.git');
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    git('init', '-q');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    writeFileSync(join(root, 'app.txt'), 'unchanged\nbefore\n');
    writeFileSync(join(root, '.gitignore'), '.env\n');
    git('add', '.');
    git('commit', '-qm', 'baseline');
    mkdirSync(join(root, '.zephyr'));
    writeFileSync(join(root, '.env'), 'NEVER_UPLOAD_SECRET');
    writeFileSync(join(root, 'app.txt'), 'unchanged\nafter\n');
    mocks.token.mockResolvedValue('private-token');
    mocks.request.mockImplementation(async (_url, _options, body) => {
      const payload = JSON.parse(body);
      return [
        true,
        null,
        {
          status: 'ok',
          recordId: 'record-1',
          applicationUid: payload.applicationUid,
          repositoryId: payload.repositoryId,
          buildId: payload.buildId,
          snapshotId: payload.snapshotId,
          sourceFingerprint: payload.attribution.sourceFingerprint,
        },
      ];
    });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  function config(
    storage: 'local' | 'remote' = 'remote',
    content?: { patch?: boolean; lines?: boolean }
  ) {
    writeAttributionConfig(root, gitDir, {
      schemaVersion: 1,
      enabled: true,
      storage,
      content,
    });
  }
  async function publish(
    tier: AttributionRepositoryPolicy['tier'] = 'paid',
    buildId = 'build-1',
    customPolicy: AttributionRepositoryPolicy | undefined = policy(tier)
  ) {
    const start = captureSource(root, 'build-start');
    const summary = finishSourceCapture(root, start, buildId);
    return publishAttribution({
      directory: root,
      summary,
      applicationUid: 'app.project.org',
      buildId,
      snapshotId: buildId,
      appConfig: {
        application_uid: 'app.project.org',
        ATTRIBUTION_POLICY: customPolicy,
      } as ZeApplicationConfig,
    });
  }
  const payload = (index = 0) => JSON.parse(mocks.request.mock.calls[index][2] as string);
  it('keeps local mode private, including a legacy config, without token resolution or network', async () => {
    writeFileSync(
      join(root, '.zephyr/attribution.json'),
      '{"schemaVersion":1,"enabled":true}'
    );
    expect(await publish('free')).toBeUndefined();
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(loadSourceRecord(root, 'build-1').files['app.txt'].content).toBeTruthy();
  });
  it.each([
    '{"schemaVersion":1,"enabled":true,"futureOption":true}',
    '{"schemaVersion":1,"enabled":false,"futureOption":true}',
    '{',
  ])(
    'keeps invalid or newer configuration private without blocking publication: %s',
    async (text) => {
      writeFileSync(join(root, '.zephyr/attribution.json'), text);
      expect(await publish()).toBeUndefined();
      expect(mocks.token).not.toHaveBeenCalled();
      expect(mocks.request).not.toHaveBeenCalled();
    }
  );
  it('keeps malformed private overrides private without blocking publication', async () => {
    config();
    mkdirSync(join(gitDir, 'zephyr-attribution'));
    writeFileSync(join(gitDir, 'zephyr-attribution/config.local.json'), '{');
    expect(await publish()).toBeUndefined();
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('publishes free patches/changed lines with exact build identity and a small public reference', async () => {
    config();
    const reference = await publish('free');
    expect(reference).toMatchObject({
      storage: 'remote',
      remote: {
        recordId: 'record-1',
        repositoryId: 'repo-1',
        policyRevision: 'revision-1',
      },
    });
    expect(reference).not.toHaveProperty('files');
    expect(reference).not.toHaveProperty('sessions');
    const body = payload();
    expect(body).toMatchObject({
      applicationUid: 'app.project.org',
      buildId: 'build-1',
      snapshotId: 'build-1',
      content: { patch: true, lines: true },
    });
    const app = body.comparison.changes.find(
      (change: { file: string }) => change.file === 'app.txt'
    );
    expect(app.patch).toContain('-before\n+after');
    expect(app.lines).toMatchObject([
      { operation: 'remove', text: 'before', origin: { kind: 'unknown' } },
      { operation: 'add', text: 'after', origin: { kind: 'unknown' } },
    ]);
    expect(JSON.stringify(body)).not.toContain('NEVER_UPLOAD_SECRET');
    expect(body.attribution.files['app.txt']).not.toHaveProperty('content');
    const options = mocks.request.mock.calls[0][1];
    expect(options).toMatchObject({
      redirect: 'error',
      sensitiveResponse: true,
      credentialToken: 'private-token',
    });
    expect(options.headers.Authorization).toBe('Bearer private-token');
  });
  it('defaults paid/BYOC to metadata only and permits independent patch/line choices', async () => {
    config();
    await publish('paid');
    await publish('byoc', 'build-2');
    expect(payload().content).toEqual({ patch: false, lines: false });
    expect(payload()).not.toHaveProperty('comparison');
    expect(payload(1)).not.toHaveProperty('comparison');
    config('remote', { patch: false, lines: true });
    await publish('paid', 'build-3');
    expect(
      payload(2).comparison.changes.every((change: object) => !('patch' in change))
    ).toBe(true);
    config('remote', { patch: true, lines: false });
    await publish('byoc', 'build-4');
    expect(
      payload(3).comparison.changes.every((change: object) => !('lines' in change))
    ).toBe(true);
    expect(payload(3).comparison.changes[0].patch).toBeTruthy();
    expect(mocks.request.mock.calls[0][1].headers['Idempotency-Key']).not.toBe(
      mocks.request.mock.calls[1][1].headers['Idempotency-Key']
    );
  });
  it('refuses free opt-out, denied policy, and repository mismatch before touching credentials', async () => {
    config('remote', { patch: false });
    await expect(publish('free')).rejects.toThrow('Free remote');
    config();
    await expect(
      publish('paid', 'build-2', { ...policy(), storage: 'local' })
    ).rejects.toThrow('repository policy');
    writeAttributionConfig(root, gitDir, {
      schemaVersion: 1,
      enabled: true,
      storage: 'remote',
      repositoryId: 'other-repo',
    });
    await expect(publish('paid', 'build-3')).rejects.toThrow('does not match');
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('requires a matching acknowledgment and fails remote publication without leaking response content', async () => {
    config();
    mocks.request.mockResolvedValue([
      true,
      null,
      { status: 'ok', recordId: 'wrong', buildId: 'other-build' },
    ]);
    await expect(publish()).rejects.toThrow('not acknowledged');
    mocks.request.mockResolvedValue([false, new Error('PRIVATE SERVER ECHO')]);
    await expect(publish('paid', 'build-2')).rejects.toThrow(
      'private evidence remains local'
    );
    expect(loadSourceRecord(root, 'build-2').files['app.txt']).toBeTruthy();
  });
  it('lets private overrides restrict sharing and rejects secrets, tiers, or escalation in config', async () => {
    config('remote', { patch: true, lines: true });
    writeAttributionConfig(
      root,
      gitDir,
      {
        schemaVersion: 1,
        enabled: true,
        storage: 'local',
        content: { patch: false, lines: false },
      },
      true
    );
    expect(await publish('free')).toBeUndefined();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(readAttributionConfig(root)?.storage).toBe('remote');
    expect(readAttributionConfig(root, gitDir)?.storage).toBe('local');
    if (process.platform !== 'win32')
      expect(
        statSync(join(gitDir, 'zephyr-attribution/config.local.json')).mode & 0o777
      ).toBe(0o600);
    expect(
      readFileSync(join(gitDir, 'zephyr-attribution/config.local.json'), 'utf8')
    ).not.toContain('token');
    expect(() =>
      writeAttributionConfig(
        root,
        gitDir,
        { schemaVersion: 1, enabled: true, storage: 'remote' },
        true
      )
    ).toThrow('Private overrides');
    expect(() =>
      writeAttributionConfig(root, gitDir, {
        schemaVersion: 1,
        enabled: true,
        tier: 'paid',
      } as never)
    ).toThrow('never credentials');
    expect(() =>
      writeAttributionConfig(root, gitDir, {
        schemaVersion: 1,
        enabled: true,
        token: 'secret',
      } as never)
    ).toThrow('never credentials');
    if (process.platform !== 'win32') {
      rmSync(join(root, '.zephyr/attribution.json'));
      symlinkSync(join(root, 'app.txt'), join(root, '.zephyr/attribution.json'));
      expect(() =>
        writeAttributionConfig(root, gitDir, { schemaVersion: 1, enabled: true })
      ).toThrow('symlink');
    }
  });
});
