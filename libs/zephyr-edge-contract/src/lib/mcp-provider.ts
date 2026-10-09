/* istanbul ignore file */

/**
 * Zephyr MCP provider contract (M1). A deployed output whose root contains
 * {@link ZEPHYR_MCP_PROVIDER_FILENAME} publishes skills and tools to the organization's
 * Zephyr MCP instead of a public web application. Types only; validation lives in
 * zephyr-agent so edge consumers stay dependency-free.
 */

/** Root descriptor file that enables MCP handling for an uploaded output. */
export const ZEPHYR_MCP_PROVIDER_FILENAME = 'mcp-provider.json';
/** Catalog file referenced by the descriptor. Fixed in M1. */
export const ZEPHYR_MCP_CATALOG_FILENAME = 'catalog.json';
/** Only runtime entry accepted in M1. */
export const ZEPHYR_MCP_RUNTIME_ENTRY = 'tools/index.js';
/** Descriptor, catalog, snapshot and build-stats manifest version. */
export const ZEPHYR_MCP_MANIFEST_VERSION = 1;
/** Format marker of CI eval results attached to a version. */
export const ZEPHYR_EVAL_RESULTS_FORMAT = 'zephyr-evals/v1';

/** `mcp-provider.json`. Strict: unknown keys are rejected. */
export interface McpProviderDescriptor {
  manifestVersion: 1;
  /** Skill-name regex; equals the catalog provider name. */
  name: string;
  /** Informational, at most 64 characters. */
  version?: string;
  /** Artifact-relative catalog path, `catalog.json` in M1. */
  catalog: string;
  /** `zephyr-cli` or `@module-federation/mcp/rslib`. */
  generator: { name: string; version: string };
}

/** Frontmatter of one skill; loose, extra keys are preserved. */
export interface CatalogSkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  'allowed-tools'?: string;
  metadata?: Record<string, string>;
  [key: string]: unknown;
}

/** One served skill file. `path` is relative to the skill directory. */
export interface CatalogFile {
  path: string;
  /** From the normative MIME table, never anything else. */
  mimeType: string;
  /** Raw byte length. */
  size: number;
  /** 64 lowercase hex characters over the raw bytes. */
  sha256: string;
  [key: string]: unknown;
}

export interface CatalogSkill {
  name: string;
  /** Always `skills/${name}`. */
  path: string;
  frontmatter: CatalogSkillFrontmatter;
  /** Includes `SKILL.md`; producers sort by path in comparison order. */
  files: CatalogFile[];
  [key: string]: unknown;
}

export interface CatalogToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  [key: string]: unknown;
}

export interface CatalogTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: { type: 'object'; [key: string]: unknown };
  outputSchema?: { type: 'object'; [key: string]: unknown };
  annotations?: CatalogToolAnnotations;
  [key: string]: unknown;
}

export interface CatalogRuntimeModule {
  path: string;
  size: number;
  sha256: string;
  [key: string]: unknown;
}

export interface CatalogRuntime {
  protocol: 1;
  /** `tools/index.js` in M1. */
  entry: string;
  /** Exactly one self-contained ES module whose path equals `entry`. */
  modules: [CatalogRuntimeModule];
  /** `YYYY-MM-DD`. */
  compatibilityDate: string;
  compatibilityFlags?: ['enable_request_signal'];
  [key: string]: unknown;
}

/** `catalog.json`. Listed fields are validated; unknown keys are preserved. */
export interface CatalogManifest {
  manifestVersion: 1;
  provider: { name: string; version?: string; [key: string]: unknown };
  skills: CatalogSkill[];
  tools: CatalogTool[];
  /** Present if and only if tools exist. */
  runtime?: CatalogRuntime;
  [key: string]: unknown;
}

export interface EvalResult {
  skill: string;
  evalId: string;
  passed: boolean;
  runs?: number;
  passRate?: number;
  durationMs?: number;
}

/** CI eval results stored with a version; never uploaded to the edge. */
export interface EvalResults {
  format: typeof ZEPHYR_EVAL_RESULTS_FORMAT;
  /** ISO 8601. */
  generatedAt: string;
  runner?: string;
  /** Canonical agent key. */
  agent?: string;
  results: EvalResult[];
  summary: { total: number; passed: number };
}

/** Names and paths only; the edge detects private MCP snapshots by this property. */
export interface SnapshotMcp {
  manifestVersion: 1;
  name: string;
  descriptor: typeof ZEPHYR_MCP_PROVIDER_FILENAME;
  catalog: string;
  catalogSha256: string;
  entry?: string;
}

/** MCP data carried to the API with build stats. */
export interface ZephyrBuildStatsMcp {
  manifestVersion: 1;
  descriptor: McpProviderDescriptor;
  /** Parsed catalog.json, inline. */
  catalog: CatalogManifest;
  /** Sha256 of the catalog.json bytes as uploaded. */
  catalogSha256: string;
  evalResults?: EvalResults;
}
