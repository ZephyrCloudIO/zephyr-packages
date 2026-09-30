import { afterEach, beforeEach, expect, it, rs } from '@rstest/core';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { handleGlobalError } from 'zephyr-agent';
import * as actualAgent from 'zephyr-agent' with { rstest: 'importActual' };
import { setupZeDeploy } from '../internal/assets/setupZeDeploy';
import { walkFiles } from '../internal/files/walkFiles';
import { walkFiles as actualWalkFiles } from '../internal/files/walkFiles' with {
  rstest: 'importActual',
};
import type { RspressPlugin } from '../types';
import { withZephyr } from '../with-zephyr';

rs.mock('zephyr-agent', () => {
  return {
    ...actualAgent,
    ZephyrEngine: {
      defer_create: () => ({
        zephyr_engine_defer: Promise.resolve({ hasActiveBuild: false }),
        zephyr_defer_create: rs.fn(),
      }),
    },
    handleGlobalError: rs.fn(),
  };
});

rs.mock('../internal/assets/setupZeDeploy', () => ({
  setupZeDeploy: rs.fn(),
}));

rs.mock('../internal/files/showFiles', () => ({ showFiles: rs.fn() }));
rs.mock('../internal/files/walkFiles', () => ({ walkFiles: rs.fn(actualWalkFiles) }));

let outDir: string;
beforeEach(() => {
  rs.clearAllMocks();
});
afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

it.each(['first', 'last'])(
  'waits for sitemap generation with Zephyr %s in the hook list',
  async (position) => {
    outDir = await mkdtemp(path.join(tmpdir(), 'zephyr-rspress-sitemap-'));
    await writeFile(path.join(outDir, 'index.html'), '<h1>Documentation</h1>');
    const generationStarted = Promise.withResolvers<void>();
    const finishGeneration = Promise.withResolvers<void>();
    const sitemap = '<urlset><url><loc>https://example.com/</loc></url></urlset>';
    const afterBuild = rs.fn(async () => {
      generationStarted.resolve();
      await finishGeneration.promise;
      await writeFile(path.join(outDir, 'sitemap.xml'), sitemap);
    });
    const sitemapPlugin = { name: 'sitemap', afterBuild };
    const config = { ssg: true, outDir: 'initial-output', plugins: [sitemapPlugin] };
    const buildConfig = { ...config, outDir };
    const plugins: RspressPlugin<typeof config>[] = [];
    const plugin = withZephyr<typeof config>();
    await plugin.config?.(
      config,
      { addPlugin: (addedPlugin) => plugins.push(addedPlugin), removePlugin: rs.fn() },
      true
    );

    await plugins[0].beforeBuild?.(buildConfig, true);
    const hooks =
      position === 'first' ? [...plugins, sitemapPlugin] : [sitemapPlugin, ...plugins];
    const publication = Promise.all(
      hooks.map((hook) => hook.afterBuild?.(buildConfig, true))
    );
    await generationStarted.promise;
    expect(walkFiles).not.toHaveBeenCalled();
    expect(setupZeDeploy).not.toHaveBeenCalled();
    finishGeneration.resolve();
    await publication;

    expect(afterBuild).toHaveBeenCalledOnce();
    expect(afterBuild).toHaveBeenCalledWith(buildConfig, true);
    expect(setupZeDeploy).toHaveBeenCalledWith(
      expect.objectContaining({
        outDir,
        files: expect.arrayContaining(['index.html', 'sitemap.xml']),
      })
    );
    expect(await readFile(path.join(outDir, 'sitemap.xml'), 'utf8')).toBe(sitemap);
    expect(handleGlobalError).not.toHaveBeenCalled();
  }
);
