export {
  hasNativeEnvReads,
  planNativeEnvRewrites,
  rewriteEnvReadsToNativeLookup,
  type NativeEnvLookupOptions,
  type NativeEnvRewriteOptions,
} from './lib/native-env-rewrite';
export { writeNativeEnvRuntimePlugin } from './lib/native-env-runtime-module';
export type { NativeEnvRuntimeRoot } from './runtime/env-runtime-plugin';
export { resolveRuntimeManifestUrl } from './lib/resolve-runtime-manifest';
export {
  NATIVE_BUILD_TARGETS,
  assertNativeBuildTarget,
  type NativeBuildTarget,
} from './lib/native-target';
