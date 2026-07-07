import type { ZephyrEngine } from 'zephyr-agent';
import { ze_log } from 'zephyr-agent';
import type { XPackConfiguration } from '../xpack.types';

/**
 * Path-addressed applications are served under a URL prefix that is not known at build
 * time (version, tag and environment routes share one build), so an origin-absolute
 * `output.publicPath` like `/` bakes asset URLs that 404 under the deployment path
 * prefix. Webpack and Rspack support `publicPath: 'auto'`, which resolves from the
 * loading script URL at runtime and works under any prefix — override to it and let the
 * user know.
 *
 * Full URLs (`https://...`) and protocol-relative (`//...`) public paths are left
 * untouched: they point at explicit hosts on purpose.
 */
export async function mutPathModePublicPath<Compiler>(
  zephyr_engine: ZephyrEngine,
  config: XPackConfiguration<Compiler>
): Promise<void> {
  const { ADDRESS_MODE } = await zephyr_engine.application_configuration;
  if (ADDRESS_MODE !== 'path') {
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
    `output.publicPath '${publicPath}' is origin-absolute, but this application uses path-based addressing. Overriding it to 'auto' so assets resolve under the deployment path prefix.`
  );
  config.output = { ...config.output, publicPath: 'auto' };
}
