import { afterAll, beforeAll, beforeEach, describe, expect, it, rs } from '@rstest/core';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import net, { type AddressInfo } from 'node:net';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Storage paths are read from HOME when zephyr-agent loads, so point it at an empty
// directory before any import below runs.
const emptyHome = rs.hoisted(() => {
  const fs = process.getBuiltinModule('node:fs');
  const os = process.getBuiltinModule('node:os');
  const path = process.getBuiltinModule('node:path');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ze-disabled-home-'));
  process.env['HOME'] = home;
  process.env['USERPROFILE'] = home;
  return home;
});

// jsonc-parser's UMD build does not bundle under rstest, and no test here reads a JSONC file.
rs.mock('jsonc-parser', () => ({ parse: JSON.parse }));

import { deployCommand } from './deploy';
import { runCommand } from './run';
import { watchCommand } from './watch';

const DISABLED_LINE =
  'The bundle is built. The bundle is not deployed. Zephyr is disabled (ZE_DISABLED).';

/**
 * Real commands, no mocks of Zephyr. There is no git repository, no token and an empty
 * HOME, and every Zephyr address points at a local server that counts requests.
 */
describe('ze-cli commands with ZE_DISABLED=true', () => {
  const saved = { ...process.env };
  let project: string;
  let server: Server;
  let requests: string[];

  beforeAll(async () => {
    project = await mkdtemp(path.join(tmpdir(), 'ze-disabled-project-'));
    requests = [];
    server = createServer((request, response) => {
      requests.push(`${request.method} ${request.url}`);
      response.writeHead(503).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    process.env['ZE_API'] = origin;
    process.env['ZE_API_GATE'] = origin;
    process.env['ZE_SECRET_TOKEN'] = 'dummy-token-for-tests';
    delete process.env['ZE_CI_TOKEN'];
    delete process.env['ZE_SERVER_TOKEN'];
    process.env['ZE_DISABLED'] = 'true';

    await writeFile(
      path.join(project, 'package.json'),
      JSON.stringify({ name: 'disabled-fixture', version: '1.0.0' })
    );
    // A complete project: with Zephyr on, the commands find a git remote and use the
    // token to call the server above, so a request here proves skip mode did not hold.
    execFileSync('git', ['init', '--quiet'], { cwd: project });
    execFileSync(
      'git',
      ['remote', 'add', 'origin', 'git@github.com:example-org/example-repo.git'],
      { cwd: project }
    );
    await mkdir(path.join(project, 'dist'));
    await writeFile(path.join(project, 'dist', 'index.js'), 'console.log("hello");\n');
    await writeFile(
      path.join(project, 'build.js'),
      "require('node:fs').writeFileSync('built.txt', 'ok');\n"
    );
    await writeFile(path.join(project, 'fail.js'), 'process.exit(3);\n');
  });

  beforeEach(() => {
    requests.length = 0;
  });

  afterAll(async () => {
    process.env = saved;
    await new Promise((resolve) => server.close(resolve));
    await rm(emptyHome, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  });

  /** Runs `action` and reports what it printed and how many sockets it opened. */
  async function observe<T>(action: () => Promise<T>) {
    const connect = rs.spyOn(net.Socket.prototype, 'connect');
    const error = rs.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => undefined);
    const log = rs.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const result = await action();
      const output = [...error.mock.calls, ...warn.mock.calls, ...log.mock.calls]
        .flat()
        .join('\n');
      return { result, output, connections: connect.mock.calls.length };
    } finally {
      connect.mockRestore();
      error.mockRestore();
      warn.mockRestore();
      log.mockRestore();
    }
  }

  it('run builds, says the bundle is not deployed, and sends no request', async () => {
    const marker = path.join(project, 'built.txt');

    const { output, connections } = await observe(() =>
      runCommand({
        commandLine: 'node build.js',
        cwd: project,
      })
    );

    expect(existsSync(marker)).toBe(true);
    expect(output).toContain(DISABLED_LINE);
    // Skip mode does not look at the build tool or its output.
    expect(output).not.toContain('too dynamic');
    expect(requests).toEqual([]);
    expect(connections).toBe(0);
  });

  it('run still fails when the build command fails', async () => {
    await expect(
      runCommand({ commandLine: 'node fail.js', cwd: project })
    ).rejects.toThrow('Build command failed with exit code 3');
    expect(requests).toEqual([]);
  });

  it('deploy skips the upload, reports it, and sends no request', async () => {
    const { result, output, connections } = await observe(() =>
      deployCommand({ directory: 'dist', cwd: project })
    );

    expect(result).toEqual({ skipped: true, reason: 'ZE_DISABLED' });
    expect(output).toContain(DISABLED_LINE);
    expect(requests).toEqual([]);
    expect(connections).toBe(0);
  });

  // Control: the same project, token and server reach Zephyr when skip mode is off, so
  // the empty request lists in this file are not an accident of the fixture.
  it('deploy contacts Zephyr when ZE_DISABLED is not set', async () => {
    process.env['ZE_DISABLED'] = 'false';
    try {
      await observe(() =>
        deployCommand({ directory: 'dist', cwd: project }).catch(() => {})
      );
      expect(requests.length).toBeGreaterThan(0);
    } finally {
      process.env['ZE_DISABLED'] = 'true';
    }
  });

  it('deploy still rejects a directory that does not exist', async () => {
    await expect(deployCommand({ directory: 'missing', cwd: project })).rejects.toThrow(
      'Directory does not exist'
    );
  });

  it('watch returns without starting a watcher or sending a request', async () => {
    const { output, connections } = await observe(() =>
      watchCommand({ directory: 'dist', target: 'tap-app', cwd: project })
    );

    expect(output).toContain(DISABLED_LINE);
    expect(requests).toEqual([]);
    expect(connections).toBe(0);
  });
});
