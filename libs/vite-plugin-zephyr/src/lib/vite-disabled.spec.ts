import { afterAll, beforeAll, describe, expect, it, rs } from '@rstest/core';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import net from 'node:net';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build, type Plugin } from 'vite';

const DISABLED_LINE =
  'The bundle is built. The bundle is not deployed. Zephyr is disabled (ZE_DISABLED).';

/** A real Vite build with no mocks, pointed at a local server that counts requests. */
describe('vite withZephyr with ZE_DISABLED=true', () => {
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
    process.env['ZE_SECRET_TOKEN'] = 'dummy-token-for-tests';
  });

  afterAll(async () => {
    process.env = saved;
    await new Promise((resolve) => server.close(resolve));
    await rm(home, { recursive: true, force: true });
    await rm(project, { recursive: true, force: true });
  });

  /** Runs one real build and reports what it printed and opened. */
  async function run(
    name: 'withZephyr' | 'withZephyrPartial',
    entry = 'index.js',
    extraPlugins: Plugin[] = []
  ) {
    const connect = rs.spyOn(net.Socket.prototype, 'connect');
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => undefined);
    const log = rs.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = rs.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const plugins = await import('./vite-plugin-zephyr');
      const partial = await import('./vite-plugin-zephyr-partial');
      let failure: unknown;
      await build({
        root: project,
        configFile: false,
        logLevel: 'silent',
        plugins: [
          ...(name === 'withZephyr'
            ? plugins.withZephyr()
            : [partial.withZephyrPartial()]),
          ...extraPlugins,
        ],
        build: {
          outDir: 'dist',
          emptyOutDir: true,
          lib: { entry: path.join(project, entry), formats: ['es'], fileName: 'out' },
        },
      }).catch((buildError: unknown) => {
        failure = buildError;
      });
      return {
        failure,
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

  it.each(['withZephyr', 'withZephyrPartial'] as const)(
    'builds the bundle, says it was not deployed, and sends no request (%s)',
    async (name) => {
      const { failure, output, connections } = await run(name);

      expect(failure).toBeUndefined();
      const [file] = await readdir(path.join(project, 'dist'));
      expect(await readFile(path.join(project, 'dist', file ?? ''), 'utf8')).toContain(
        'hello'
      );
      expect(output).toContain(DISABLED_LINE);
      expect(requests).toEqual([]);
      expect(connections).toBe(0);
    }
  );

  it('does not say the bundle is built when the build fails', async () => {
    await writeFile(path.join(project, 'broken.js'), "import './does-not-exist';\n");

    const { failure, output } = await run('withZephyr', 'broken.js');

    expect(failure).toBeDefined();
    expect(output).not.toContain(DISABLED_LINE);
    expect(requests).toEqual([]);
  });

  it('does not say the bundle is built when rendering the output fails', async () => {
    const failsToRender: Plugin = {
      name: 'fails-to-render',
      renderChunk() {
        throw new Error('render failed');
      },
    };

    const { failure, output } = await run('withZephyr', 'index.js', [failsToRender]);

    expect(failure).toBeDefined();
    expect(output).not.toContain(DISABLED_LINE);
    expect(requests).toEqual([]);
  });

  // Control: the same project, token and server reach Zephyr when skip mode is off, so
  // the empty request list above is not an accident of the fixture.
  it('contacts Zephyr when ZE_DISABLED is not set', async () => {
    process.env['ZE_DISABLED'] = 'false';
    try {
      const { output } = await run('withZephyr');

      expect(requests.length).toBeGreaterThan(0);
      expect(output).not.toContain(DISABLED_LINE);
    } finally {
      process.env['ZE_DISABLED'] = 'true';
    }
  });
});
