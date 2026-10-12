export const DOCTOR_SCHEMA_VERSION = '1.1.0';

export const DoctorExitCode = {
  Healthy: 0,
  Findings: 1,
  InvalidProject: 2,
  ToolFailure: 3,
} as const;

export type DoctorExitCode = (typeof DoctorExitCode)[keyof typeof DoctorExitCode];

export const DoctorFindingCode = {
  ProjectNotFound: 'ZD0001',
  PackageJsonMissing: 'ZD0002',
  PackageJsonInvalid: 'ZD0003',
  ToolFailure: 'ZD0004',
  BundlerNotDetected: 'ZD0101',
  RsbuildConfigMissing: 'ZD0102',
  ZephyrPluginNotDeclared: 'ZD0201',
  ZephyrPluginNotInstalled: 'ZD0202',
  ZephyrPluginConfigMissing: 'ZD0203',
  ZephyrPluginOrder: 'ZD0204',
  ModuleFederationPluginConfigMissing: 'ZD0210',
  LockfileMissing: 'ZD0301',
  PackageNotInstalled: 'ZD0302',
  PackageVersionMismatch: 'ZD0303',
  LockfileUnsupported: 'ZD0304',
  AssetPrefixMissing: 'ZD0401',
  AssetPrefixInvalid: 'ZD0402',
  SourceEntryMissing: 'ZD0403',
  ExposeKeyInvalid: 'ZD0410',
  RemotesMustBeObject: 'ZD0411',
  RemoteDependencyAliasMismatch: 'ZD0412',
  WebWatchUsesTapCommand: 'ZD0501',
  TapWatchTargetMissing: 'ZD0502',
  TapWatchMetadataMissing: 'ZD0503',
  DtsDiagnosticFailure: 'ZD0601',
  McpRepoEmpty: 'ZD0701',
  McpSkillUnknownEntry: 'ZD0702',
  McpSkillMissingFile: 'ZD0710',
  McpSkillFrontmatterInvalid: 'ZD0711',
  McpSkillNameInvalid: 'ZD0712',
  McpSkillDescriptionInvalid: 'ZD0713',
  McpSkillMetadataInvalid: 'ZD0714',
  McpSkillOwnerMissing: 'ZD0715',
  McpSkillLinkBroken: 'ZD0716',
  McpSkillTooLong: 'ZD0717',
  McpSkillSecret: 'ZD0718',
  McpSkillFileTooLarge: 'ZD0719',
  McpEvalsInvalid: 'ZD0720',
  McpEvalsSkillMismatch: 'ZD0721',
  McpToolNameInvalid: 'ZD0730',
  McpToolHintMissing: 'ZD0731',
  McpToolsBuildMissing: 'ZD0732',
  McpToolSecret: 'ZD0733',
  McpToolNameReserved: 'ZD0734',
  McpToolNameMismatch: 'ZD0735',
  McpToolExportInvalid: 'ZD0736',
  McpToolSchemaInvalid: 'ZD0737',
  McpArtifactDescriptorInvalid: 'ZD0740',
  McpArtifactCatalogInvalid: 'ZD0741',
  McpArtifactPathDenied: 'ZD0742',
  McpCatalogNameClash: 'ZD0743',
} as const;

export type DoctorFindingCode =
  (typeof DoctorFindingCode)[keyof typeof DoctorFindingCode];

/** MCP finding codes (ZD07xx). */
export type DoctorMcpFindingCode = Extract<DoctorFindingCode, `ZD07${string}`>;

/**
 * Stable rule ids shared with `zephyr-mcp` repo checks. Each ZD07xx code maps to exactly
 * one rule id.
 */
export const DoctorMcpRuleId: Readonly<Record<DoctorMcpFindingCode, string>> = {
  ZD0701: 'repo-empty',
  ZD0702: 'skill-unknown-entry',
  ZD0710: 'skill-missing-file',
  ZD0711: 'skill-frontmatter-invalid',
  ZD0712: 'skill-name-invalid',
  ZD0713: 'skill-description-invalid',
  ZD0714: 'skill-metadata-invalid',
  ZD0715: 'skill-owner-missing',
  ZD0716: 'skill-link-broken',
  ZD0717: 'skill-too-long',
  ZD0718: 'skill-secret',
  ZD0719: 'skill-file-too-large',
  ZD0720: 'evals-invalid',
  ZD0721: 'evals-skill-mismatch',
  ZD0730: 'tool-name-invalid',
  ZD0731: 'tool-hint-missing',
  ZD0732: 'tools-build-missing',
  ZD0733: 'tool-secret',
  ZD0734: 'tool-name-reserved',
  ZD0735: 'tool-name-mismatch',
  ZD0736: 'tool-export-invalid',
  ZD0737: 'tool-schema-invalid',
  ZD0740: 'artifact-descriptor-invalid',
  ZD0741: 'artifact-catalog-invalid',
  ZD0742: 'artifact-path-denied',
  ZD0743: 'catalog-name-clash',
};

export type DoctorSeverity = 'info' | 'warning' | 'error';
export type DoctorStatus = 'healthy' | 'findings' | 'invalid_project' | 'tool_failure';

export interface DoctorEvidence {
  /** Project-relative path; never an absolute path. */
  path: string;
  line?: number;
  /** A bounded, redacted fact such as a package version or config key. */
  detail?: string;
}

export interface DoctorFinding {
  code: DoctorFindingCode;
  /** Stable MCP rule id for ZD07xx findings (schema 1.1.0). */
  rule?: string;
  severity: DoctorSeverity;
  message: string;
  evidence: DoctorEvidence[];
  remediation: string;
}

export interface DoctorDeclaredVersion {
  path: string;
  range: string;
}

export interface DoctorInstalledVersion {
  path: string;
  version: string;
}

export interface DoctorPackageState {
  name: string;
  declared: DoctorDeclaredVersion[];
  locked: string[];
  installed: DoctorInstalledVersion[];
}

export type SupportedBundler =
  | 'rsbuild'
  | 'rspack'
  | 'webpack'
  | 'vite'
  | 'rollup'
  | 'rslib';

export interface DoctorBundlerState {
  name: SupportedBundler;
  configFiles: string[];
}

export interface DoctorConfigState {
  path: string;
  bundler: SupportedBundler;
  zephyrPlugin: boolean;
  moduleFederationPlugin: boolean;
  assetPrefix: 'auto' | 'missing' | 'other';
  sourceEntry: boolean;
  exposes: string[];
  remotes: string[];
}

export interface DoctorWatchState {
  mode: 'web' | 'tap-app' | 'unknown';
  scriptNames: Array<{
    path: string;
    names: string[];
  }>;
  recommendedCommand: string | null;
}

export interface DoctorDtsState {
  logs: string[];
  temporaryArtifacts: string[];
  typeArchives: string[];
  diagnosticCommands: string[];
}

/** How `ze-cli` classifies a directory for MCP publication (contract 8.1). */
export type DoctorMcpClassification =
  | 'provider-artifact'
  | 'skills-repo'
  | 'tools-repo'
  | 'tools-without-package-json';

/** Optional MCP section (schema 1.1.0); present only for MCP-classified directories. */
export interface DoctorMcpState {
  classification: DoctorMcpClassification;
  /** Skill names (skill folders in a repo, catalog skills in an artifact). */
  skills: string[];
  /** Tool names (tool files in a repo, catalog tools in an artifact). */
  tools: string[];
  /** Project-relative descriptor path when one exists, else null. */
  descriptor: string | null;
  /**
   * Whether the package checks (lockfile, bundlers, watch mode, DTS) also ran: true for a
   * tools repo or a skills repo with a package.json.
   */
  packageChecks: boolean;
}

export interface DoctorReport {
  schemaVersion: typeof DOCTOR_SCHEMA_VERSION;
  command: 'doctor';
  status: DoctorStatus;
  exitCode: DoctorExitCode;
  projectDirectory: string;
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun' | 'unknown';
  lockfile: string | null;
  bundlers: DoctorBundlerState[];
  configs: DoctorConfigState[];
  packages: DoctorPackageState[];
  watch: DoctorWatchState;
  dts: DoctorDtsState;
  /** MCP publication state; absent for directories that are not MCP providers. */
  mcp?: DoctorMcpState;
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  findings: DoctorFinding[];
}
