import { join } from 'node:path';
import { ZeErrors, ZephyrError } from 'zephyr-agent';

/**
 * The `next.config` fields this plugin reads or sets. No index signature, so Next's own
 * `NextConfig` interface is assignable to it.
 */
export interface NextConfigLike {
  output?: string;
  assetPrefix?: string;
  adapterPath?: string;
}

type NextConfigFunction<T> = (...args: any[]) => T | Promise<T>;

/**
 * Absolute path of the ESM adapter build. Next.js loads adapters with `import()` and
 * unwraps `default` once, which leaves a CommonJS build's `{ default }` wrapper in place
 * and silently skips `onBuildComplete`.
 */
export function resolveAdapterPath(): string {
  return join(__dirname, '..', 'adapter.mjs');
}

function applyZephyr<T extends NextConfigLike>(config: T): T {
  if (config.assetPrefix) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        'zephyr-nextjs-plugin serves /_next/static through your Next.js server from Zephyr. Remove `assetPrefix` from next.config.',
    });
  }
  if (config.output && config.output !== 'standalone') {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: `zephyr-nextjs-plugin needs \`output: 'standalone'\`, got \`output: '${config.output}'\`.`,
    });
  }
  if (config.adapterPath && config.adapterPath !== resolveAdapterPath()) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: `next.config already sets \`adapterPath\` (${config.adapterPath}). Next.js runs a single adapter.`,
    });
  }

  return { ...config, output: 'standalone', adapterPath: resolveAdapterPath() } as T;
}

/**
 * Deploys a Next.js build's `/_next/static` files to Zephyr Cloud and prepares a
 * standalone server that streams them from that deployment.
 *
 * ```ts
 * // next.config.ts
 * import { withZephyr } from 'zephyr-nextjs-plugin';
 * export default withZephyr({ reactStrictMode: true });
 * ```
 */
export function withZephyr<T extends NextConfigLike>(config: T): T;
export function withZephyr<T extends NextConfigLike>(
  config: NextConfigFunction<T>
): NextConfigFunction<T>;
export function withZephyr<T extends NextConfigLike>(
  config: T | NextConfigFunction<T> = {} as T
): T | NextConfigFunction<T> {
  if (typeof config === 'function') {
    return async (...args) => applyZephyr(await config(...args));
  }
  return applyZephyr(config);
}
