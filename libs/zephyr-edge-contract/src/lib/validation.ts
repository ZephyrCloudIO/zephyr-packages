import { z } from 'zod';

/**
 * Zod validation schemas for Zephyr types
 *
 * These schemas provide runtime validation for data that comes from:
 *
 * - Network requests (OTA manifest fetching)
 * - Storage (AsyncStorage/localStorage)
 * - External APIs
 */

/** Zod schema for ZephyrDependency */
export const ZephyrDependencySchema = z.object({
  application_uid: z.string(),
  remote_entry_url: z.string().url(),
  default_url: z.string().url(),
  name: z.string(),
  library_type: z.string(),
});

/** Zod schema for ZephyrManifest */
export const ZephyrManifestSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  dependencies: z.record(z.string(), ZephyrDependencySchema),
  zeVars: z.record(z.string(), z.string()),
  ota_enabled: z.boolean().optional(),
  application_uid: z.string().optional(),
});

/** Zod schema for OTAManifest (extends ZephyrManifest) */
export const OTAManifestSchema = ZephyrManifestSchema.extend({
  ota_enabled: z.literal(true),
  application_uid: z.string(),
  release_notes: z.string().optional(),
  critical: z.boolean().optional(),
  min_app_version: z.string().optional(),
});

/** Zod schema for OTAVersionResponse */
export const OTAVersionResponseSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  manifest_url: z.string().url(),
  description: z.string().optional(),
  critical: z.boolean().optional(),
  release_notes: z.string().optional(),
});

/** Zod schema for OTACheckRequest */
export const OTACheckRequestSchema = z.object({
  application_uid: z.string(),
  current_version: z.string().optional(),
  current_timestamp: z.string().optional(),
  platform: z.enum(['ios', 'android']).optional(),
});

/** Zod schema for StoredVersionInfo (internal storage) */
export const StoredVersionInfoSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  lastChecked: z.number(),
});

/** Zod schema for OTA Metrics */
export const OTAMetricsSchema = z.object({
  checksPerformed: z.number(),
  updatesAvailable: z.number(),
  updatesApplied: z.number(),
  updatesFailed: z.number(),
  lastCheckTimestamp: z.number(),
  lastUpdateTimestamp: z.number().optional(),
});

/** Type guard for ZephyrManifest */
export function isZephyrManifest(
  data: unknown
): data is z.infer<typeof ZephyrManifestSchema> {
  return ZephyrManifestSchema.safeParse(data).success;
}

/** Type guard for OTAVersionResponse */
export function isOTAVersionResponse(
  data: unknown
): data is z.infer<typeof OTAVersionResponseSchema> {
  return OTAVersionResponseSchema.safeParse(data).success;
}

/** Type guard for StoredVersionInfo */
export function isStoredVersionInfo(
  data: unknown
): data is z.infer<typeof StoredVersionInfoSchema> {
  return StoredVersionInfoSchema.safeParse(data).success;
}

/** Type guard for OTAMetrics */
export function isOTAMetrics(data: unknown): data is z.infer<typeof OTAMetricsSchema> {
  return OTAMetricsSchema.safeParse(data).success;
}

/**
 * Validates and parses a ZephyrManifest with helpful error messages
 *
 * @throws {Error} If validation fails
 */
export function validateManifest(data: unknown): z.infer<typeof ZephyrManifestSchema> {
  const result = ZephyrManifestSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.format();
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(`Invalid manifest: ${JSON.stringify(errors)}`);
  }
  return result.data;
}

/**
 * Validates and parses an OTAVersionResponse with helpful error messages
 *
 * @throws {Error} If validation fails
 */
export function validateOTAVersionResponse(
  data: unknown
): z.infer<typeof OTAVersionResponseSchema> {
  const result = OTAVersionResponseSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.format();
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(`Invalid OTA version response: ${JSON.stringify(errors)}`);
  }
  return result.data;
}

/**
 * Validates and parses StoredVersionInfo with helpful error messages
 *
 * @throws {Error} If validation fails
 */
export function validateStoredVersionInfo(
  data: unknown
): z.infer<typeof StoredVersionInfoSchema> {
  const result = StoredVersionInfoSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.format();
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(`Invalid stored version info: ${JSON.stringify(errors)}`);
  }
  return result.data;
}
