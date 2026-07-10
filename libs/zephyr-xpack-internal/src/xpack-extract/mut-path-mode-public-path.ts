import type { ZephyrEngine } from 'zephyr-agent';
import { usesPathAddressing, ze_log } from 'zephyr-agent';
import type { XPackConfiguration } from '../xpack.types';

/** Normalize origin-root asset paths for builds targeting any path-addressed edge. */
export async function mutPathModePublicPath<Compiler>(
  zephyrEngine: ZephyrEngine,
  config: XPackConfiguration<Compiler>
): Promise<void> {
  if (!usesPathAddressing(await zephyrEngine.application_configuration)) {
    return;
  }

  const publicPath: unknown = config.output?.publicPath;
  if (
    typeof publicPath !== 'string' ||
    !publicPath.startsWith('/') ||
    publicPath.startsWith('//')
  ) {
    return;
  }

  ze_log.misc(
    `output.publicPath '${publicPath}' is origin-absolute for a path-addressed target; overriding it to 'auto'.`
  );
  config.output = { ...config.output, publicPath: 'auto' };
}
