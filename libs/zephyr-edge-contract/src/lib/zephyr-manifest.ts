import { z } from 'zod';
import { ZephyrDependencySchema } from './zephyr-build-stats';

export const ZEPHYR_MANIFEST_VERSION = '1.0.0';

export const ZephyrManifestSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  dependencies: z.record(z.string(), ZephyrDependencySchema),
  zeVars: z.record(z.string(), z.string()),
});
export type ZephyrManifest = z.infer<typeof ZephyrManifestSchema>;
