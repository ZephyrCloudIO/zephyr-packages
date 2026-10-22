import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core';
import * as fs from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { analyzeProject } from './analyze';
import { formatDoctorReport } from './format';
import { addOnlineChecks } from './online';
import {
  DOCTOR_ONLINE_SCHEMA_VERSION,
  DOCTOR_SCHEMA_VERSION,
  DoctorExitCode,
  DoctorFindingCode,
  type DoctorReport,
} from './schema';

const SECRET = 'dummy-secret-token-for-tests';
const APPLICATION_UID = 'host.repo.org';
const fixtureRoot = path.join(import.meta.dirname, '__fixtures__');
const installedVersions = {
  '@module-federation/rsbuild-plugin': '2.8.0',
  '@rsbuild/core': '2.1.5',
  typescript: '5.9.3',
  'zephyr-rsbuild-plugin': '1.2.0',
};

interface Fake {
  origin: string;
  requests: Array<{ method?: string; url?: string; authorization?: string }>;
  close(): Promise<void>;
}

type Handler = (request: IncomingMessage, origin: string) => [number, unknown?];

async function startFake(handler: Handler): Promise<Fake> {
  const requests: Fake['requests'] = [];
  let origin = '';
  const server: Server = createServer((request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
    });
    const [status, body] = handler(request, origin);
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(body === undefined ? '' : JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    origin,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** A Zephyr that answers every request correctly. */
const reachable: Handler = (request, origin) => {
  if (request.url === '/user-info') return [200, { value: { name: 'Test' } }];
  if (request.url === `/application-config/${APPLICATION_UID}`) {
    return [
      200,
      { value: { application_uid: APPLICATION_UID, EDGE_URL: `${origin}/edge/` } },
    ];
  }
  return [200, { ok: true }];
};

async function closedPortOrigin(): Promise<string> {
  const fake = await startFake(() => [200]);
  const { origin } = fake;
  await fake.close();
  return origin;
}

const fakes: Fake[] = [];
const temporaryDirectories: string[] = [];
const savedEnv = { ...process.env };
let healthyProject: string;

async function start(handler: Handler): Promise<Fake> {
  const fake = await startFake(handler);
  fakes.push(fake);
  return fake;
}

function point(api: string, gateway = api): void {
  process.env['ZE_API'] = api;
  process.env['ZE_API_GATE'] = gateway;
}

const deps = {
  resolveCredentials: async () => ({ source: 'ZE_SECRET_TOKEN' as const, token: SECRET }),
  resolveApplicationUid: async () => ({ uid: APPLICATION_UID }),
};

async function runOnline(options: { timeoutMs?: number; deps?: object } = {}) {
  const offline = await analyzeProject(healthyProject);
  expect(offline.exitCode).toBe(DoctorExitCode.Healthy);
  return addOnlineChecks(offline, { timeoutMs: 2_000, deps, ...options });
}

function codes(report: DoctorReport): string[] {
  return report.findings.map(({ code }) => code);
}

function checkStatuses(report: DoctorReport): Record<string, string> {
  return Object.fromEntries((report.online?.checks ?? []).map((c) => [c.id, c.status]));
}

beforeAll(async () => {
  const directory = await fs.promises.mkdtemp(path.join(tmpdir(), 'ze-doctor-online-'));
  temporaryDirectories.push(directory);
  healthyProject = path.join(directory, 'healthy-rsbuild');
  await fs.promises.cp(path.join(fixtureRoot, 'healthy-rsbuild'), healthyProject, {
    recursive: true,
  });
  await materializePackageManifests(healthyProject);
  for (const [name, version] of Object.entries(installedVersions)) {
    const packageDirectory = path.join(healthyProject, 'node_modules', name);
    await fs.promises.mkdir(packageDirectory, { recursive: true });
    await fs.promises.writeFile(
      path.join(packageDirectory, 'package.json'),
      JSON.stringify({ name, version })
    );
  }
});

afterEach(async () => {
  process.env = { ...savedEnv };
  await Promise.all(fakes.splice(0).map((fake) => fake.close()));
});

afterAll(async () => {
  await Promise.all(
    temporaryDirectories.map((dir) =>
      fs.promises.rm(dir, { recursive: true, force: true })
    )
  );
});

describe('doctor --online against local fakes', () => {
  it('reports a reachable Zephyr with valid credentials as healthy', async () => {
    const zephyr = await start(reachable);
    point(zephyr.origin);

    const report = await runOnline();

    expect(report.findings).toEqual([]);
    expect(report.exitCode).toBe(DoctorExitCode.Healthy);
    expect(report.status).toBe('healthy');
    expect(report.schemaVersion).toBe(DOCTOR_ONLINE_SCHEMA_VERSION);
    expect(report.online).toEqual({
      timeoutMs: 2_000,
      checks: [
        { id: 'api', status: 'passed', target: zephyr.origin, httpStatus: 200 },
        { id: 'gateway', status: 'passed', target: zephyr.origin, httpStatus: 200 },
        { id: 'token', status: 'passed', target: zephyr.origin, httpStatus: 200 },
        { id: 'application', status: 'passed', target: zephyr.origin, httpStatus: 200 },
        { id: 'edge', status: 'passed', target: zephyr.origin, httpStatus: 200 },
      ],
    });
    expect(zephyr.requests.map(({ url }) => url)).toEqual([
      '/',
      '/',
      '/user-info',
      `/application-config/${APPLICATION_UID}`,
      '/edge/',
    ]);
    // The credential is sent to the gateway only, and never to the edge.
    expect(zephyr.requests.map(({ authorization }) => authorization)).toEqual([
      undefined,
      undefined,
      `Bearer ${SECRET}`,
      `Bearer ${SECRET}`,
      undefined,
    ]);
  });

  it('reports a closed port as unreachable and skips the checks that depend on it', async () => {
    const closed = await closedPortOrigin();
    point(closed);

    const report = await runOnline();

    expect(codes(report).sort()).toEqual([
      DoctorFindingCode.ApiUnreachable,
      DoctorFindingCode.GatewayUnreachable,
    ]);
    expect(report.findings[0]).toMatchObject({
      severity: 'error',
      check: expect.any(String),
      target: closed,
      nextAction: 'retry_later',
      message: expect.stringContaining('connection refused'),
    });
    expect(checkStatuses(report)).toEqual({
      api: 'failed',
      gateway: 'failed',
      token: 'skipped',
      application: 'skipped',
      edge: 'skipped',
    });
    expect(report.status).toBe('findings');
    expect(report.exitCode).toBe(DoctorExitCode.Findings);
  });

  it('reports a 503 server as unavailable, not as unreachable', async () => {
    const down = await start(() => [503]);
    point(down.origin);

    const report = await runOnline();

    expect(codes(report).sort()).toEqual([
      DoctorFindingCode.ApiUnavailable,
      DoctorFindingCode.GatewayUnavailable,
    ]);
    expect(report.findings[0]).toMatchObject({
      nextAction: 'retry_later',
      message: expect.stringContaining('HTTP 503'),
    });
    expect(report.online?.checks[0]).toMatchObject({
      id: 'api',
      status: 'failed',
      httpStatus: 503,
      findingCode: DoctorFindingCode.ApiUnavailable,
    });
    expect(report.exitCode).toBe(DoctorExitCode.Findings);
  });

  it('reports an invalid token as a token problem, not as an outage', async () => {
    const zephyr = await start((request, origin) =>
      request.url === '/user-info' ? [401] : reachable(request, origin)
    );
    point(zephyr.origin);

    const report = await runOnline();

    expect(codes(report)).toEqual([DoctorFindingCode.TokenInvalid]);
    expect(report.findings[0]).toMatchObject({
      severity: 'error',
      check: 'token',
      nextAction: 'refresh_credentials',
    });
    expect(checkStatuses(report)).toMatchObject({
      api: 'passed',
      gateway: 'passed',
      token: 'failed',
      application: 'skipped',
      edge: 'skipped',
    });
    expect(report.exitCode).toBe(DoctorExitCode.Findings);
  });

  it('gives each of the four situations a different finding', async () => {
    const results: string[][] = [];

    const ok = await start(reachable);
    point(ok.origin);
    results.push(codes(await runOnline()));

    point(await closedPortOrigin());
    results.push(codes(await runOnline()));

    const down = await start(() => [503]);
    point(down.origin);
    results.push(codes(await runOnline()));

    const invalid = await start((request, origin) =>
      request.url === '/user-info' ? [401] : reachable(request, origin)
    );
    point(invalid.origin);
    results.push(codes(await runOnline()));

    expect(new Set(results.map((list) => list.join(','))).size).toBe(4);
  });

  it('stops waiting when a server never answers', async () => {
    // This server accepts the connection and never answers.
    const silent = createServer(() => undefined);
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(silent.address() as AddressInfo).port}`;
    point(origin);

    const started = Date.now();
    const report = await runOnline({ timeoutMs: 150 });
    const elapsed = Date.now() - started;
    silent.closeAllConnections();
    await new Promise((resolve) => silent.close(resolve));

    expect(codes(report).sort()).toEqual([
      DoctorFindingCode.ApiUnreachable,
      DoctorFindingCode.GatewayUnreachable,
    ]);
    expect(report.findings[0]?.message).toContain('No answer within 150 ms');
    expect(report.online?.timeoutMs).toBe(150);
    expect(elapsed).toBeLessThan(2_000);
  });

  it('reports a missing application, a rejected token and a broken answer separately', async () => {
    const notFound = await start((request, origin) =>
      request.url?.startsWith('/application-config/') ? [404] : reachable(request, origin)
    );
    point(notFound.origin);
    const missing = await runOnline();
    expect(codes(missing)).toEqual([DoctorFindingCode.ApplicationConfigNotFound]);
    expect(missing.findings[0]).toMatchObject({ nextAction: 'correct_request' });
    expect(checkStatuses(missing)).toMatchObject({
      application: 'failed',
      edge: 'skipped',
    });

    const forbidden = await start((request, origin) =>
      request.url?.startsWith('/application-config/') ? [403] : reachable(request, origin)
    );
    point(forbidden.origin);
    const rejected = await runOnline();
    expect(codes(rejected)).toEqual([DoctorFindingCode.ApplicationConfigRejected]);
    expect(rejected.findings[0]).toMatchObject({ nextAction: 'check_permissions' });

    const broken = await start((request, origin) =>
      request.url?.startsWith('/application-config/')
        ? [200, { value: { application_uid: APPLICATION_UID } }]
        : reachable(request, origin)
    );
    point(broken.origin);
    const invalid = await runOnline();
    expect(codes(invalid)).toEqual([DoctorFindingCode.ApplicationConfigInvalid]);

    const failing = await start((request, origin) =>
      request.url?.startsWith('/application-config/') ? [502] : reachable(request, origin)
    );
    point(failing.origin);
    const unavailable = await runOnline();
    expect(codes(unavailable)).toEqual([DoctorFindingCode.ApplicationConfigUnavailable]);
    expect(unavailable.findings[0]).toMatchObject({ nextAction: 'retry_later' });
  });

  it('reports an edge URL that is down or closed', async () => {
    const zephyr = await start((request, origin) => {
      if (request.url === '/edge/') return [503];
      return reachable(request, origin);
    });
    point(zephyr.origin);
    const unavailable = await runOnline();
    expect(codes(unavailable)).toEqual([DoctorFindingCode.EdgeUnavailable]);
    expect(checkStatuses(unavailable)).toMatchObject({
      application: 'passed',
      edge: 'failed',
    });

    const closed = await closedPortOrigin();
    const gateway = await start((request) =>
      request.url === '/user-info'
        ? [200, {}]
        : request.url?.startsWith('/application-config/')
          ? [200, { value: { application_uid: APPLICATION_UID, EDGE_URL: `${closed}/` } }]
          : [200]
    );
    point(gateway.origin);
    const unreachable = await runOnline();
    expect(codes(unreachable)).toEqual([DoctorFindingCode.EdgeUnreachable]);
  });

  it('reports a missing token without sending any request that needs it', async () => {
    const zephyr = await start(reachable);
    point(zephyr.origin);

    const report = await runOnline({
      deps: { ...deps, resolveCredentials: async () => ({ source: 'none' as const }) },
    });

    expect(codes(report)).toEqual([DoctorFindingCode.TokenMissing]);
    expect(report.findings[0]).toMatchObject({ nextAction: 'refresh_credentials' });
    expect(checkStatuses(report)).toMatchObject({
      token: 'failed',
      application: 'skipped',
    });
    expect(zephyr.requests.filter(({ authorization }) => authorization)).toEqual([]);
  });

  it('says so, without failing, when the token needs an exchange', async () => {
    const zephyr = await start(reachable);
    point(zephyr.origin);

    const report = await runOnline({
      deps: {
        ...deps,
        resolveCredentials: async () => ({ source: 'exchange' as const }),
      },
    });

    expect(codes(report)).toEqual([DoctorFindingCode.TokenNotChecked]);
    expect(report.findings[0]?.severity).toBe('info');
    expect(report.exitCode).toBe(DoctorExitCode.Healthy);
  });

  it('warns when the application name cannot be found', async () => {
    const zephyr = await start(reachable);
    point(zephyr.origin);

    const report = await runOnline({
      deps: {
        ...deps,
        resolveApplicationUid: async () => ({ reason: 'unresolved' as const }),
      },
    });

    expect(codes(report)).toEqual([DoctorFindingCode.ApplicationUnresolved]);
    expect(report.findings[0]?.severity).toBe('warning');
    expect(report.exitCode).toBe(DoctorExitCode.Findings);
  });

  it('does not run project files to find the application name', async () => {
    const zephyr = await start(reachable);
    point(zephyr.origin);

    const report = await runOnline({
      deps: {
        ...deps,
        resolveApplicationUid: async () => ({ reason: 'config-file' as const }),
      },
    });

    expect(codes(report)).toEqual([DoctorFindingCode.ApplicationUnresolved]);
    expect(report.findings[0]?.severity).toBe('info');
    expect(report.exitCode).toBe(DoctorExitCode.Healthy);
    expect(
      zephyr.requests.some(({ url }) => url?.startsWith('/application-config'))
    ).toBe(false);
  });

  it('reads ZE_SECRET_TOKEN from the environment by default', async () => {
    const zephyr = await start(reachable);
    point(zephyr.origin);
    process.env['ZE_SECRET_TOKEN'] = SECRET;

    const offline = await analyzeProject(healthyProject);
    const report = await addOnlineChecks(offline, {
      timeoutMs: 2_000,
      deps: { resolveApplicationUid: async () => ({ uid: APPLICATION_UID }) },
    });

    expect(report.findings).toEqual([]);
    expect(zephyr.requests.find(({ url }) => url === '/user-info')?.authorization).toBe(
      `Bearer ${SECRET}`
    );
  });

  it('keeps the project exit code when the project itself is invalid', async () => {
    const zephyr = await start(reachable);
    point(zephyr.origin);
    const missing = path.join(path.dirname(healthyProject), 'missing');
    const offline = await analyzeProject(missing);
    expect(offline.exitCode).toBe(DoctorExitCode.InvalidProject);

    const report = await addOnlineChecks(offline, { timeoutMs: 2_000, deps });

    expect(report.exitCode).toBe(DoctorExitCode.InvalidProject);
    expect(report.status).toBe('invalid_project');
    expect(checkStatuses(report)).toMatchObject({
      api: 'passed',
      application: 'skipped',
    });
  });

  it('returns a tool failure with exit code 3 when a check throws unexpectedly', async () => {
    const zephyr = await start(reachable);
    point(zephyr.origin);

    const report = await runOnline({
      deps: {
        ...deps,
        resolveCredentials: async () => {
          throw new Error('storage unreadable');
        },
      },
    });

    expect(report.status).toBe('tool_failure');
    expect(report.exitCode).toBe(DoctorExitCode.ToolFailure);
    expect(codes(report)).toContain(DoctorFindingCode.ToolFailure);
    expect(checkStatuses(report)).toEqual({ api: 'passed', gateway: 'passed' });
    expect(JSON.stringify(report)).not.toContain('storage unreadable');
  });

  it('reports a malformed ZE_API_GATE as a configuration problem, not a tool failure', async () => {
    const zephyr = await start(reachable);
    process.env['ZE_API'] = zephyr.origin;
    process.env['ZE_API_GATE'] = 'zeapi.example.com';

    const report = await runOnline();

    expect(codes(report)).toEqual([DoctorFindingCode.EndpointInvalid]);
    expect(report.findings[0]).toMatchObject({
      check: 'gateway',
      nextAction: 'correct_request',
      message: expect.stringContaining('ZE_API_GATE'),
    });
    expect(checkStatuses(report)).toEqual({
      api: 'passed',
      gateway: 'failed',
      token: 'skipped',
      application: 'skipped',
      edge: 'skipped',
    });
    expect(report.exitCode).toBe(DoctorExitCode.Findings);
  });

  it('keeps finished checks and a missing-project exit code when a check throws', async () => {
    const zephyr = await start(reachable);
    point(zephyr.origin);
    const offline = await analyzeProject(
      path.join(path.dirname(healthyProject), 'missing')
    );

    const report = await addOnlineChecks(offline, {
      timeoutMs: 2_000,
      deps: {
        ...deps,
        resolveCredentials: async () => {
          throw new Error('storage unreadable');
        },
      },
    });

    expect(report.exitCode).toBe(DoctorExitCode.InvalidProject);
    expect(codes(report)).toContain(DoctorFindingCode.ToolFailure);
    expect(checkStatuses(report)).toEqual({ api: 'passed', gateway: 'passed' });
  });

  it('never prints the token or an absolute path in a finding or the check list', async () => {
    const closed = await closedPortOrigin();
    point(closed);
    const offline = await analyzeProject(healthyProject);
    const report = await addOnlineChecks(offline, { timeoutMs: 2_000, deps });

    const online = JSON.stringify({ findings: report.findings, online: report.online });
    const text = formatDoctorReport(report, 'text');
    const onlineText = text.slice(text.indexOf('Findings:'));

    for (const output of [online, onlineText]) {
      expect(output).not.toContain(SECRET);
      expect(output).not.toContain(tmpdir());
    }
    expect(text).toContain('Online checks (limit 2000 ms each):');
    expect(text).toContain('api: failed ZD0701');
  });
});

describe('doctor without --online', () => {
  it('keeps the offline report and its schema version unchanged', async () => {
    const report = await analyzeProject(healthyProject);

    expect(report.schemaVersion).toBe(DOCTOR_SCHEMA_VERSION);
    expect(report.schemaVersion).toBe('1.0.0');
    expect(report).not.toHaveProperty('online');
    expect(JSON.stringify(report)).not.toContain('"nextAction"');
    expect(formatDoctorReport(report, 'text')).not.toContain('Online checks');
  });
});

async function materializePackageManifests(directory: string): Promise<void> {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await materializePackageManifests(absolutePath);
    } else if (entry.name === 'package.fixture.json') {
      await fs.promises.rename(absolutePath, path.join(directory, 'package.json'));
    }
  }
}
