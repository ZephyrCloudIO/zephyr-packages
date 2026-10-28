import { createRequire } from 'module';
import {
  hasNativeEnvReads,
  planNativeEnvRewrites,
  type NativeEnvLookupOptions,
} from 'zephyr-native-internal';

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
  getCacheKey?: (...args: unknown[]) => string;
  [key: string]: unknown;
}

/** The parts of Babel's plugin API and `NodePath` this plugin uses. */
interface BabelApi {
  template: { expression: { ast: (code: string) => unknown } };
}

interface BabelPath {
  node: object;
  replaceWith: (node: unknown) => unknown;
  skip: () => void;
  traverse: (visitor: { enter: (path: BabelPath) => void }) => void;
}

const NODE_MODULES = /(^|[\\/])node_modules[\\/]/;

/**
 * Babel plugin applying the native env rewrite to the AST of the configured transformer.
 * The file is parsed by that transformer (Flow component syntax included), and the
 * inserted lookups carry no source location, so Metro's source maps keep the original
 * positions of all surrounding code.
 */
function zephyrNativeEnvBabelPlugin(api: BabelApi, options: NativeEnvLookupOptions) {
  return {
    name: 'zephyr-native-env-rewrite',
    visitor: {
      Program(program: BabelPath) {
        const rewrites = planNativeEnvRewrites(program.node, options);
        if (rewrites.size === 0) return;
        program.traverse({
          enter(path) {
            const code = rewrites.get(path.node);
            if (code === undefined) return;
            path.replaceWith(api.template.expression.ast(`(${code})`));
            path.skip();
          },
        });
      },
    },
  };
}

/**
 * Wraps Metro's configured Babel transformer so app sources have their `ZE_PUBLIC_*`
 * reads rewritten to runtime lookups during its Babel pass. Used by the generated module
 * that `withZephyr` installs as `transformer.babelTransformerPath`.
 */
export function createZephyrEnvTransformer(
  options: ZephyrEnvTransformerOptions
): BabelTransformer {
  const { originalTransformerPath, applicationUid, buildEnv, cacheKey } = options;
  // Metro transformers are CommonJS modules exporting `transform` (and optionally
  // `getCacheKey`); the path is absolute, so the require base is irrelevant.
  const original: BabelTransformer = createRequire(__filename)(originalTransformerPath);
  const plugin = [zephyrNativeEnvBabelPlugin, { applicationUid, buildEnv }];

  return {
    ...original,
    transform(args) {
      if (NODE_MODULES.test(args.filename) || !hasNativeEnvReads(args.src)) {
        return original.transform(args);
      }
      const plugins = Array.isArray(args['plugins']) ? args['plugins'] : [];
      return original.transform({ ...args, plugins: [plugin, ...plugins] });
    },
    // Metro passes options such as `projectRoot`; transformers like Expo's hash Babel
    // config files with them.
    getCacheKey(...args) {
      return [original.getCacheKey?.(...args) ?? '', cacheKey].join('$');
    },
  };
}
