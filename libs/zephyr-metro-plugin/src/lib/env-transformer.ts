import { createRequire } from 'module';
import { rewriteEnvReadsToNativeLookup } from 'zephyr-agent';

export interface ZephyrEnvTransformerOptions {
  /** Absolute path of the Babel transformer Metro was configured with. */
  originalTransformerPath: string;
  /** Zephyr application UID that scopes runtime overrides. */
  applicationUid: string;
  /** Build-time `ZE_PUBLIC_*` values compiled in as fallbacks. */
  buildEnv: Record<string, string>;
  /** Folded into Metro's transform cache key so env or UID changes invalidate it. */
  cacheKey: string;
}

/** Arguments Metro passes to `babelTransformerPath`'s `transform`. */
interface BabelTransformerArgs {
  filename: string;
  src: string;
  [key: string]: unknown;
}

interface BabelTransformer {
  transform: (args: BabelTransformerArgs) => unknown;
  getCacheKey?: () => string;
  [key: string]: unknown;
}

const NODE_MODULES = /(^|[\\/])node_modules[\\/]/;

/**
 * Wraps Metro's configured Babel transformer so app sources have their `ZE_PUBLIC_*`
 * reads rewritten to runtime lookups before Babel runs. Used by the generated module that
 * `withZephyr` installs as `transformer.babelTransformerPath`.
 */
export function createZephyrEnvTransformer(
  options: ZephyrEnvTransformerOptions
): BabelTransformer {
  const { originalTransformerPath, applicationUid, buildEnv, cacheKey } = options;
  // Metro transformers are CommonJS modules exporting `transform` (and optionally
  // `getCacheKey`); the path is absolute, so the require base is irrelevant.
  const original: BabelTransformer = createRequire(__filename)(originalTransformerPath);

  return {
    ...original,
    transform(args) {
      if (NODE_MODULES.test(args.filename)) return original.transform(args);
      const rewritten = rewriteEnvReadsToNativeLookup(args.src, {
        filename: args.filename,
        applicationUid,
        buildEnv,
      });
      return original.transform({ ...args, src: rewritten?.code ?? args.src });
    },
    getCacheKey() {
      return [original.getCacheKey?.() ?? '', cacheKey].join('$');
    },
  };
}
