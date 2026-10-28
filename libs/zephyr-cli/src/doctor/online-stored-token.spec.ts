import { afterAll, afterEach, beforeAll, describe, expect, it, rs } from '@rstest/core';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Storage paths are read from HOME when zephyr-agent loads, so point it at an empty
// directory before any import below runs.
const emptyHome = rs.hoisted(() => {
  const fs = process.getBuiltinModule('node:fs');
  const os = process.getBuiltinModule('node:os');
  const path = process.getBuiltinModule('node:path');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ze-doctor-home-'));
  process.env['HOME'] = home;
  process.env['USERPROFILE'] = home;
  return home;
});

import { analyzeProject } from './analyze';
import { addOnlineChecks } from './online';
import { DoctorFindingCode } from './schema';

const STORED = 'dummy-stored-login-token';
const STORAGE_KEY = 'ze-auth-token';

function storedTokenFile(): string {
  const digest = createHash('sha256').update(STORAGE_KEY).digest('hex');
  return path.join(emptyHome, '.zephyr', 'storage', digest);
}

describe('doctor --online with a stored login', () => {
  const saved = { ...process.env };
  let project: string;
  let server: Server;
  let authorizations: Array<string | undefined>;

  beforeAll(async () => {
    project = fs.mkdtempSync(path.join(tmpdir(), 'ze-doctor-stored-'));
    fs.writeFileSync(
      path.join(project, 'package.json'),
      JSON.stringify({ name: 'demo', version: '1.0.0' })
    );
    authorizations = [];
    server = createServer((request, response) => {
      authorizations.push(request.headers.authorization);
      // The token is always rejected.
      response.writeHead(request.url === '/user-info' ? 401 : 200).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env['ZE_API'] = origin;
    process.env['ZE_API_GATE'] = origin;
    delete process.env['ZE_SECRET_TOKEN'];
    delete process.env['ZE_CI_TOKEN'];
    delete process.env['ZE_SERVER_TOKEN'];
  });

  afterEach(() => {
    authorizations.length = 0;
  });

  afterAll(async () => {
    process.env = saved;
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(emptyHome, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  });

  it('reads the stored token, reports it as invalid, and does not delete it', async () => {
    fs.mkdirSync(path.dirname(storedTokenFile()), { recursive: true });
    const record = JSON.stringify({ key: STORAGE_KEY, value: STORED });
    fs.writeFileSync(storedTokenFile(), record);

    const report = await addOnlineChecks(await analyzeProject(project), {
      timeoutMs: 2_000,
      deps: { resolveApplicationUid: async () => ({ uid: 'demo.repo.org' }) },
    });

    expect(report.findings.map(({ code }) => code)).toContain(
      DoctorFindingCode.TokenInvalid
    );
    expect(authorizations).toContain(`Bearer ${STORED}`);
    // A 401 from a probe must not remove the user's login.
    expect(fs.readFileSync(storedTokenFile(), 'utf8')).toBe(record);
    expect(JSON.stringify(report)).not.toContain(STORED);
  });

  it('reports a missing token when there is no stored login', async () => {
    fs.rmSync(storedTokenFile(), { force: true });

    const report = await addOnlineChecks(await analyzeProject(project), {
      timeoutMs: 2_000,
    });

    expect(report.findings.map(({ code }) => code)).toContain(
      DoctorFindingCode.TokenMissing
    );
    expect(authorizations.filter(Boolean)).toEqual([]);
  });
});
