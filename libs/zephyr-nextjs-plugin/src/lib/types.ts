/**
 * The subset of Next.js's adapter API (`next/dist/build/adapter/build-complete`) this
 * plugin reads. Declared structurally so the package does not need `next` to build.
 */
export interface NextStaticFileOutput {
  /** Absolute filesystem path to the built file. */
  filePath: string;
  /** Routable URL pathname, including `basePath`. */
  pathname: string;
}

export interface NextBuildCompleteContext {
  outputs: { staticFiles: NextStaticFileOutput[] };
  projectDir: string;
  repoRoot: string;
  distDir: string;
  buildId: string;
  nextVersion: string;
  config: {
    basePath?: string;
    assetPrefix?: string;
    output?: string;
    outputFileTracingRoot?: string;
  };
}

export interface NextAdapter {
  name: string;
  onBuildComplete?: (ctx: NextBuildCompleteContext) => Promise<void> | void;
}

/**
 * Written to `.next/zephyr/zephyr-deployment.json` after a successful upload. The runtime
 * server reads it to know which Zephyr deployment holds this build's assets.
 */
export interface ZephyrNextDeployment {
  /** Immutable Zephyr version URL that serves this build's `/_next/static` files. */
  url: string;
  /** Next.js build ID. The runtime verifies the Zephyr URL serves the same build. */
  buildId: string;
  basePath: string;
  /** A file inside `/_next/static/<buildId>/` used to verify the deployment. */
  probe: string;
  /** Directory of the standalone `server.js`, relative to `.next/standalone`. */
  serverDir: string;
}
