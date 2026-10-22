import { afterAll, beforeAll, describe, expect, it, rs } from '@rstest/core';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import net from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rspack, type Configuration } from '@rspack/core';

const DISABLED_LINE =
  'The bundle is built. The bundle is not deployed. Zephyr is disabled (ZE_DISABLED).';

/** A real rspack build with no mocks, pointed at a local server that counts requests. */
describe('rspack withZephyr with ZE_DISABLED=true', () => {
  const saved = { ...process.env };
  let home: string;
  let project: string;
  let server: Server;
  let requests: string[];

  beforeAll(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'ze-disabled-home-'));
    project = await mkdtemp(path.join(tmpdir(), 'ze-disabled-project-'));
    requests = [];
    server = createServer((request, response) => {
      requests.push(`${request.method} ${request.url}`);
      response.writeHead(503).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    // Storage paths are read from HOME when zephyr-agent loads.
    process.env['HOME'] = home;
    process.env['USERPROFILE'] = home;
    process.env['ZE_API'] = origin;
    process.env['ZE_API_GATE'] = origin;
    delete process.env['ZE_SECRET_TOKEN'];
    process.env['ZE_DISABLED'] = 'true';

    await writeFile(path.join(project, 'index.js'), 'console.log("hello");\n');
  });

  afterAll(async () => {
    process.env = saved;
    await new Promise((resolve) => server.close(resolve));
    await rm(home, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  });

  it('builds the bundle, says it was not deployed, and sends no request', async () => {
    const connect = rs.spyOn(net.Socket.prototype, 'connect');
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => undefined);
    const log = rs.spyOn(console, 'log').mockImplementation(() => undefined);
    const { withZephyr } = await import('./with-zephyr');

    const config = (await withZephyr()({
      mode: 'development',
      devtool: false,
      context: project,
      entry: path.join(project, 'index.js'),
      output: { path: path.join(project, 'dist') },
    } satisfies Configuration)) as Configuration;

    await new Promise<void>((resolve, reject) => {
      rspack(config, (error, stats) => {
        if (error ?? stats?.hasErrors())
          reject(
            error ??
              new Error(stats?.toString({ all: false, errors: true }) ?? 'build failed')
          );
        else resolve();
      });
    });

    const output = [...warn.mock.calls, ...log.mock.calls].flat().join('\n');
    const emitted = await readFile(path.join(project, 'dist', 'main.js'), 'utf8');
    // rspack may only open sockets for Zephyr; none are expected at all.
    const connections = connect.mock.calls.length;
    warn.mockRestore();
    log.mockRestore();
    connect.mockRestore();

    expect(emitted).toContain('hello');
    expect(output).toContain(DISABLED_LINE);
    expect(output.split(DISABLED_LINE)).toHaveLength(2);
    expect(requests).toEqual([]);
    expect(connections).toBe(0);
  });
});
