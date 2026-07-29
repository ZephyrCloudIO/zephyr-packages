export const DOCTOR_SCHEMA_VERSION = '1.0.0';

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
} as const;

export type DoctorFindingCode =
  (typeof DoctorFindingCode)[keyof typeof DoctorFindingCode];

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
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  findings: DoctorFinding[];
}
