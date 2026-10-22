import { afterAll, beforeAll, describe, expect, it, rs } from '@rstest/core';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import net from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import webpack, { type Configuration } from 'webpack';

const DISABLED_LINE =
  'The bundle is built. The bundle is not deployed. Zephyr is disabled (ZE_DISABLED).';

/** A real webpack build with no mocks, pointed at a local server that counts requests. */
describe('webpack withZephyr with ZE_DISABLED=true', () => {
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
    process.env['ZE_DISABLED'] = 'true';

    await writeFile(path.join(project, 'index.js'), 'console.log("hello");\n');
    await writeFile(
      path.join(project, 'package.json'),
      JSON.stringify({ name: 'disabled-fixture', version: '1.0.0' })
    );
    // A complete project: with Zephyr on, the plugin would find a git remote and use the
    // token to call the server above, so a request here proves skip mode did not hold.
    execFileSync('git', ['init', '--quiet'], { cwd: project });
    execFileSync(
      'git',
      ['remote', 'add', 'origin', 'git@github.com:example-org/example-repo.git'],
      { cwd: project }
    );
    // CI builds need real commit history, so give the project one.
    for (const args of [
      ['config', 'user.name', 'Test'],
      ['config', 'user.email', 'test@example.com'],
      ['add', '-A'],
      ['commit', '--quiet', '-m', 'init'],
    ]) {
      execFileSync('git', args, { cwd: project });
    }
    process.env['ZE_SECRET_TOKEN'] = 'dummy-token-for-tests';
  });

  afterAll(async () => {
    process.env = saved;
    await new Promise((resolve) => server.close(resolve));
    await rm(home, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  });

  /** Configures and runs one real build, and reports what it printed and opened. */
  async function build(entry = 'index.js') {
    const connect = rs.spyOn(net.Socket.prototype, 'connect');
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => undefined);
    const log = rs.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = rs.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { withZephyr } = await import('./with-zephyr');
      const config = (await withZephyr()({
        mode: 'development',
        devtool: false,
        context: project,
        entry: path.join(project, entry),
        output: { path: path.join(project, 'dist') },
      } satisfies Configuration)) as Configuration;

      const failed = await new Promise<boolean>((resolve, reject) => {
        webpack(config, (buildError, stats) =>
          buildError ? reject(buildError) : resolve(Boolean(stats?.hasErrors()))
        );
      });
      return {
        failed,
        output: [...warn.mock.calls, ...log.mock.calls, ...error.mock.calls]
          .flat()
          .join('\n'),
        connections: connect.mock.calls.length,
      };
    } finally {
      connect.mockRestore();
      warn.mockRestore();
      log.mockRestore();
      error.mockRestore();
    }
  }

  it('builds the bundle, says it was not deployed, and sends no request', async () => {
    const { failed, output, connections } = await build();

    expect(failed).toBe(false);
    expect(await readFile(path.join(project, 'dist', 'main.js'), 'utf8')).toContain(
      'hello'
    );
    expect(output).toContain(DISABLED_LINE);
    expect(output.split(DISABLED_LINE)).toHaveLength(2);
    expect(requests).toEqual([]);
    expect(connections).toBe(0);
  });

  it('does not say the bundle is built when the build fails', async () => {
    await writeFile(path.join(project, 'broken.js'), "import './does-not-exist';\n");

    const { failed, output } = await build('broken.js');

    expect(failed).toBe(true);
    expect(output).not.toContain(DISABLED_LINE);
    expect(requests).toEqual([]);
  });

  // Control: the same project, token and server reach Zephyr when skip mode is off, so
  // the empty request list above is not an accident of the fixture.
  it('contacts Zephyr when ZE_DISABLED is not set', async () => {
    process.env['ZE_DISABLED'] = 'false';
    try {
      // CI sets ZE_FAIL_BUILD=true, which makes the failed request reject the config.
      const result = await build().catch(() => undefined);

      expect(requests.length).toBeGreaterThan(0);
      expect(result?.output ?? '').not.toContain(DISABLED_LINE);
    } finally {
      process.env['ZE_DISABLED'] = 'true';
    }
  });
});
