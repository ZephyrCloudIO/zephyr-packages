import { describe, expect, it, rs } from '@rstest/core';

import {
  resolveTanStackOutputDir,
  withZephyr,
  withZephyrTanstackStart,
} from './vite-plugin-tanstack-start-zephyr';

describe('vite-plugin-tanstack-start-zephyr exports', () => {
  it('keeps the deprecated alias wired to withZephyr', () => {
    expect(withZephyrTanstackStart).toBe(withZephyr);
  });

  it('runs after framework buildApp hooks', () => {
    const plugin = withZephyr();
    expect(plugin.buildApp).toEqual(
      expect.objectContaining({ order: 'post', handler: expect.any(Function) })
    );
  });

  it('resolves relative output overrides from Vite root', () => {
    expect(resolveTanStackOutputDir('/repo/apps/site', 'build/output')).toBe(
      '/repo/apps/site/build/output'
    );
    expect(resolveTanStackOutputDir('/repo/apps/site')).toBe('/repo/apps/site/dist');
    expect(resolveTanStackOutputDir('/repo/apps/site', '/shared/output')).toBe(
      '/shared/output'
    );
  });

  it('rejects entrypoints outside the output directory', () => {
    const plugin = withZephyr({ entrypoint: '../secret.js' });
    expect(() =>
      (plugin.configResolved as (config: unknown) => void)({
        root: '/repo',
      })
    ).toThrow('inside the output directory');
  });

  it('fails an incomplete build without spawning child compilers', async () => {
    const plugin = withZephyr();
    const build = rs.fn();
    const hook = plugin.buildApp as {
      handler: (builder: unknown) => Promise<void>;
    };

    await expect(
      hook.handler({
        environments: {
          client: { isBuilt: true },
          server: { isBuilt: false },
        },
        build,
      })
    ).rejects.toThrow('server');
    expect(build).not.toHaveBeenCalled();
  });
});
