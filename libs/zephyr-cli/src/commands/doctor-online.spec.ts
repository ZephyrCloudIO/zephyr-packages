import { afterAll, beforeAll, describe, expect, it, rs } from '@rstest/core';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Storage paths are read from HOME when zephyr-agent loads, so point it at an empty
// directory before any import below runs.
const emptyHome = rs.hoisted(() => {
  const fs = process.getBuiltinModule('node:fs');
  const os = process.getBuiltinModule('node:os');
  const path = process.getBuiltinModule('node:path');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ze-doctor-cmd-home-'));
  process.env['HOME'] = home;
  process.env['USERPROFILE'] = home;
  return home;
});

import { doctorCommand } from './doctor';

/**
 * The real command with the real application lookup (no injected UID), as the CLI runs
 * it: everything printed to stdout must be one JSON document.
 */
describe('doctorCommand --online --format json', () => {
  const saved = { ...process.env };
  let project: string;
  let server: Server;

  beforeAll(async () => {
    project = fs.mkdtempSync(path.join(tmpdir(), 'ze-doctor-cmd-project-'));
    // No zephyr:dependencies field: the build helper would log a hint about it.
    fs.writeFileSync(
      path.join(project, 'package.json'),
      JSON.stringify({ name: 'host', version: '1.0.0' })
    );
    execFileSync('git', ['init', '--quiet'], { cwd: project });
    execFileSync(
      'git',
      ['remote', 'add', 'origin', 'git@github.com:example-org/example-repo.git'],
      { cwd: project }
    );

    server = createServer((request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      if (request.url?.startsWith('/application-config/')) {
        const { host } = request.headers;
        response.end(
          JSON.stringify({
            value: {
              application_uid: 'host.example-repo.example-org',
              EDGE_URL: `http://${host}/edge/`,
            },
          })
        );
      } else {
        response.end('{}');
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env['ZE_API'] = origin;
    process.env['ZE_API_GATE'] = origin;
    process.env['ZE_SECRET_TOKEN'] = 'dummy-token-for-tests';
    delete process.env['ZE_CI_TOKEN'];
    delete process.env['ZE_SERVER_TOKEN'];
  });

  afterAll(async () => {
    process.env = saved;
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(emptyHome, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  });

  it('prints one parseable JSON document and checks the real application', async () => {
    const log = rs.spyOn(console, 'log').mockImplementation(() => undefined);
    const write = rs.spyOn(process.stdout, 'write').mockImplementation(() => true);
    let exitCode: number;
    try {
      exitCode = await doctorCommand({
        directory: project,
        format: 'json',
        online: true,
        timeoutMs: 2_000,
        cwd: project,
      });
      expect(write.mock.calls).toEqual([]);
      expect(log.mock.calls).toHaveLength(1);
      const report = JSON.parse(String(log.mock.calls[0]?.[0])) as {
        online: { checks: Array<{ id: string; status: string }> };
      };
      expect(report.online.checks.map(({ id, status }) => `${id}:${status}`)).toEqual([
        'api:passed',
        'gateway:passed',
        'token:passed',
        'application:passed',
        'edge:passed',
      ]);
    } finally {
      rs.restoreAllMocks();
    }
    // The project itself has findings (no bundler); the online checks add none.
    expect(exitCode).toBeLessThanOrEqual(1);
  });
});
