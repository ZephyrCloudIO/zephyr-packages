export const DOCTOR_SCHEMA_VERSION = '1.0.0';

/**
 * The version of a report made with `--online`. It adds the optional `online` object and
 * the optional `check`, `target` and `nextAction` fields on findings. Offline reports
 * keep `DOCTOR_SCHEMA_VERSION` and do not contain these fields.
 */
export const DOCTOR_ONLINE_SCHEMA_VERSION = '1.1.0';

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
  // Online checks (`doctor --online`)
  ApiUnreachable: 'ZD0701',
  ApiUnavailable: 'ZD0702',
  GatewayUnreachable: 'ZD0703',
  GatewayUnavailable: 'ZD0704',
  TokenMissing: 'ZD0705',
  TokenInvalid: 'ZD0706',
  TokenForbidden: 'ZD0707',
  TokenNotChecked: 'ZD0708',
  ApplicationUnresolved: 'ZD0709',
  ApplicationConfigNotFound: 'ZD0710',
  ApplicationConfigRejected: 'ZD0711',
  ApplicationConfigInvalid: 'ZD0712',
  ApplicationConfigUnavailable: 'ZD0713',
  EdgeUnreachable: 'ZD0714',
  EdgeUnavailable: 'ZD0715',
  EndpointInvalid: 'ZD0716',
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

/** The same values as the MCP `nextAction` field. */
export type DoctorNextAction =
  | 'none'
  | 'refresh_credentials'
  | 'check_permissions'
  | 'retry_later'
  | 'correct_request';

export type DoctorOnlineCheckId = 'api' | 'gateway' | 'token' | 'application' | 'edge';

export interface DoctorFinding {
  code: DoctorFindingCode;
  severity: DoctorSeverity;
  message: string;
  evidence: DoctorEvidence[];
  remediation: string;
  /** Online findings only: the check that produced this finding. */
  check?: DoctorOnlineCheckId;
  /** Online findings only: the origin that was contacted. It has no path or query. */
  target?: string;
  /** Online findings only: what to do next. */
  nextAction?: DoctorNextAction;
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

/**
 * - `passed`: the check ran and found nothing wrong.
 * - `failed`: the check ran and produced a finding.
 * - `skipped`: the check did not run, or could not reach a verdict, because an earlier
 *   check failed or the input was missing.
 */
export type DoctorOnlineCheckStatus = 'passed' | 'failed' | 'skipped';

export interface DoctorOnlineCheck {
  id: DoctorOnlineCheckId;
  status: DoctorOnlineCheckStatus;
  /** The origin that was contacted, or `null` when no request was made. */
  target: string | null;
  /** The HTTP status code, when the server answered. */
  httpStatus?: number;
  /** The finding that explains a `failed` or `skipped` check. */
  findingCode?: DoctorFindingCode;
}

export interface DoctorOnlineState {
  /** The limit applied to each check, in milliseconds. */
  timeoutMs: number;
  checks: DoctorOnlineCheck[];
}

export interface DoctorReport {
  schemaVersion: typeof DOCTOR_SCHEMA_VERSION | typeof DOCTOR_ONLINE_SCHEMA_VERSION;
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
  /** Present only in reports made with `--online`. */
  online?: DoctorOnlineState;
}
