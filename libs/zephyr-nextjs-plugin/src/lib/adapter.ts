import { copyFile, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  buildAssetsMap,
  handleGlobalError,
  isZephyrDisabled,
  logZephyrDisabled,
  zeBuildDashData,
  ZeErrors,
  ZephyrEngine,
  ZephyrError,
} from 'zephyr-agent';
import { collectStaticAssets } from './collect-static-assets';
import type {
  NextAdapter,
  NextBuildCompleteContext,
  ZephyrNextDeployment,
} from './types';

/** Output folder inside `.next`, copied next to the standalone server in the image. */
export const ZEPHYR_OUTPUT_DIR = 'zephyr';
export const DEPLOYMENT_FILE = 'zephyr-deployment.json';
export const RUNTIME_SERVER_FILE = 'zephyr-server.mjs';

async function onBuildComplete(ctx: NextBuildCompleteContext): Promise<void> {
  const outputDir = join(ctx.distDir, ZEPHYR_OUTPUT_DIR);
  // Never leave a previous build's deployment record behind for the image to pick up.
  await rm(outputDir, { recursive: true, force: true });

  if (isZephyrDisabled()) {
    logZephyrDisabled();
    return;
  }

  let zephyrEngine: ZephyrEngine | undefined;
  let buildInProgress = false;
  try {
    const basePath = ctx.config.basePath ?? '';
    const { files, probe } = collectStaticAssets(
      ctx.outputs.staticFiles,
      basePath,
      ctx.buildId
    );
    if (!probe) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: `No /_next/static/${ctx.buildId}/ files found in the Next.js build output.`,
      });
    }

    const contents: Record<string, Buffer> = {};
    for (const [snapshotPath, filePath] of Object.entries(files)) {
      contents[snapshotPath] = await readFile(filePath);
    }

    zephyrEngine = await ZephyrEngine.create({
      builder: 'unknown',
      context: ctx.projectDir,
    });
    buildInProgress = true;

    let url: string | undefined;
    await zephyrEngine.upload_assets({
      assetsMap: buildAssetsMap(
        contents,
        (content) => content,
        () => 'buffer'
      ),
      buildStats: await zeBuildDashData(zephyrEngine),
      // A plain static snapshot: the Zephyr edge only serves these files. Rendering
      // stays on the Next.js server in your container, never on Zephyr's SSR runtime.
      snapshotType: 'csr',
      hooks: {
        onDeployComplete: (info) => {
          url = info.url;
        },
      },
    });
    buildInProgress = false;
    await zephyrEngine.build_finished();

    if (!url) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: 'Zephyr did not return a deployment URL for the Next.js static assets.',
      });
    }

    const deployment: ZephyrNextDeployment = {
      url,
      buildId: ctx.buildId,
      basePath,
      probe,
      serverDir: relative(
        ctx.config.outputFileTracingRoot ?? ctx.repoRoot,
        ctx.projectDir
      ).replace(/\\/g, '/'),
    };
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      join(outputDir, DEPLOYMENT_FILE),
      JSON.stringify(deployment, null, 2)
    );
    // Shipped as plain JavaScript at the package root (dist/lib -> ../../runtime).
    await copyFile(
      join(__dirname, '..', '..', 'runtime', RUNTIME_SERVER_FILE),
      join(outputDir, RUNTIME_SERVER_FILE)
    );
    // Next.js serves public/ from next to server.js, which sits at serverDir inside the
    // standalone output. Mirroring that layout here lets one `COPY .next/zephyr/ ./`
    // place it correctly, in a monorepo or not.
    const publicDir = join(ctx.projectDir, 'public');
    if (
      await stat(publicDir).then(
        (s) => s.isDirectory(),
        () => false
      )
    ) {
      await cp(publicDir, join(outputDir, deployment.serverDir, 'public'), {
        recursive: true,
      });
    }
  } catch (error) {
    handleGlobalError(error);
  } finally {
    if (buildInProgress && zephyrEngine?.hasActiveBuild !== false) {
      zephyrEngine?.build_failed();
    }
  }
}

export const zephyrNextAdapter: NextAdapter = {
  name: 'zephyr-nextjs-plugin',
  onBuildComplete,
};
