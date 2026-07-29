import * as fs from 'node:fs';
import path from 'node:path';
import {
  DOCTOR_SCHEMA_VERSION,
  DoctorExitCode,
  DoctorFindingCode,
  type DoctorBundlerState,
  type DoctorConfigState,
  type DoctorDtsState,
  type DoctorFinding,
  type DoctorPackageState,
  type DoctorReport,
  type DoctorWatchState,
  type SupportedBundler,
} from './schema';

const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_SCAN_DIRECTORIES = 10_000;
const CONFIG_FILE_PATTERN =
  /^(rsbuild|rspack|webpack|vite|rollup|rslib)\.config\.(?:js|mjs|cjs|ts|mts|cts)$/u;
const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.turbo',
  '.output',
  'build',
  'coverage',
  'dist',
  'out',
  'node_modules',
]);

type PackageManager = DoctorReport['packageManager'];

interface PackageManifest {
  absolutePath: string;
  relativePath: string;
  directory: string;
  data: PackageJson;
}

interface PackageJson {
  name?: string;
  version?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  'zephyr:dependencies'?: Record<string, string>;
  'zephyr:target'?: string;
}

interface ConfigFile {
  absolutePath: string;
  relativePath: string;
  bundler: SupportedBundler;
  manifest: PackageManifest;
}

interface LockState {
  path: string | null;
  packageManager: PackageManager;
  format: Exclude<PackageManager, 'unknown'> | null;
  versions: Map<string, Set<string>>;
  supported: boolean;
}

interface PropertyContainer {
  kind: 'object' | 'array';
  body: string;
  start: number;
}

export interface DoctorOptions {
  cwd?: string;
}

export async function analyzeProject(
  directory = '.',
  options: DoctorOptions = {}
): Promise<DoctorReport> {
  const projectDirectory = path.resolve(options.cwd ?? process.cwd(), directory);
  const report = createBaseReport(projectDirectory);

  try {
    let rootStats: fs.Stats;
    try {
      rootStats = await fs.promises.stat(projectDirectory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return invalidProjectReport(
          report,
          DoctorFindingCode.ProjectNotFound,
          'The requested project directory does not exist.',
          'Pass an existing project directory containing package.json.'
        );
      }
      throw error;
    }

    if (!rootStats.isDirectory()) {
      return invalidProjectReport(
        report,
        DoctorFindingCode.ProjectNotFound,
        'The requested project path is not a directory.',
        'Pass a project directory containing package.json.'
      );
    }

    const rootPackagePath = path.join(projectDirectory, 'package.json');
    if (!(await pathExists(rootPackagePath))) {
      return invalidProjectReport(
        report,
        DoctorFindingCode.PackageJsonMissing,
        'No package.json was found in the requested project directory.',
        'Run doctor from the project or workspace root.'
      );
    }

    const rootManifestResult = await readPackageManifest(
      rootPackagePath,
      projectDirectory
    );
    if (!rootManifestResult.manifest) {
      return invalidProjectReport(
        report,
        DoctorFindingCode.PackageJsonInvalid,
        'The root package.json could not be parsed.',
        'Fix the JSON syntax in package.json before running doctor again.',
        rootManifestResult.detail
      );
    }

    const findings: DoctorFinding[] = [];
    const manifests = await discoverPackageManifests(
      projectDirectory,
      rootManifestResult.manifest,
      findings
    );
    const configFiles = await discoverConfigFiles(projectDirectory, manifests);
    const lockState = await inspectLockfile(
      projectDirectory,
      rootManifestResult.manifest.data
    );

    report.packageManager = lockState.packageManager;
    report.lockfile = lockState.path;
    report.bundlers = detectBundlers(manifests, configFiles);
    report.configs = await inspectConfigs(projectDirectory, configFiles, findings);
    report.packages = await inspectPackages(
      projectDirectory,
      manifests,
      lockState,
      findings
    );
    inspectBundlerReadiness(report.bundlers, report.configs, manifests, findings);
    inspectLockfileReadiness(lockState, findings);
    report.watch = inspectWatchMode(manifests, report.bundlers, findings);
    report.dts = await inspectDtsEvidence(
      projectDirectory,
      manifests,
      report.packageManager,
      findings
    );

    return finalizeReport(report, findings);
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    report.findings = [
      {
        code: DoctorFindingCode.ToolFailure,
        severity: 'error',
        message: 'Zephyr Doctor could not complete the read-only project scan.',
        evidence: [
          {
            path: '.',
            detail: errorCode ? `filesystem error: ${errorCode}` : 'unexpected error',
          },
        ],
        remediation:
          'Verify the directory is readable and retry. Use --format json when reporting the failure.',
      },
    ];
    report.summary = { errors: 1, warnings: 0, info: 0 };
    report.status = 'tool_failure';
    report.exitCode = DoctorExitCode.ToolFailure;
    return report;
  }
}

function createBaseReport(projectDirectory: string): DoctorReport {
  return {
    schemaVersion: DOCTOR_SCHEMA_VERSION,
    command: 'doctor',
    status: 'healthy',
    exitCode: DoctorExitCode.Healthy,
    projectDirectory,
    packageManager: 'unknown',
    lockfile: null,
    bundlers: [],
    configs: [],
    packages: [],
    watch: {
      mode: 'unknown',
      scriptNames: [],
      recommendedCommand: null,
    },
    dts: {
      logs: [],
      temporaryArtifacts: [],
      typeArchives: [],
      diagnosticCommands: [],
    },
    summary: { errors: 0, warnings: 0, info: 0 },
    findings: [],
  };
}

function invalidProjectReport(
  report: DoctorReport,
  code:
    | typeof DoctorFindingCode.ProjectNotFound
    | typeof DoctorFindingCode.PackageJsonMissing
    | typeof DoctorFindingCode.PackageJsonInvalid,
  message: string,
  remediation: string,
  detail?: string
): DoctorReport {
  report.status = 'invalid_project';
  report.exitCode = DoctorExitCode.InvalidProject;
  report.findings = [
    {
      code,
      severity: 'error',
      message,
      evidence: [{ path: 'package.json', detail }],
      remediation,
    },
  ];
  report.summary = { errors: 1, warnings: 0, info: 0 };
  return report;
}

function finalizeReport(report: DoctorReport, findings: DoctorFinding[]): DoctorReport {
  report.findings = findings.sort(
    (left, right) =>
      severityRank(left.severity) - severityRank(right.severity) ||
      left.code.localeCompare(right.code) ||
      (left.evidence[0]?.path ?? '').localeCompare(right.evidence[0]?.path ?? '')
  );
  report.summary = {
    errors: findings.filter(({ severity }) => severity === 'error').length,
    warnings: findings.filter(({ severity }) => severity === 'warning').length,
    info: findings.filter(({ severity }) => severity === 'info').length,
  };
  if (report.summary.errors > 0 || report.summary.warnings > 0) {
    report.status = 'findings';
    report.exitCode = DoctorExitCode.Findings;
  }
  return report;
}

function severityRank(severity: DoctorFinding['severity']): number {
  return severity === 'error' ? 0 : severity === 'warning' ? 1 : 2;
}

async function discoverPackageManifests(
  root: string,
  rootManifest: PackageManifest,
  findings: DoctorFinding[]
): Promise<PackageManifest[]> {
  const manifests = [rootManifest];
  let visitedDirectories = 0;

  const visit = async (directory: string): Promise<void> => {
    visitedDirectories += 1;
    if (visitedDirectories > MAX_SCAN_DIRECTORIES) {
      throw new Error(`Project scan exceeded ${MAX_SCAN_DIRECTORIES} directories.`);
    }

    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      const childDirectory = path.join(directory, entry.name);
      const childPackagePath = path.join(childDirectory, 'package.json');
      if (await pathExists(childPackagePath)) {
        const result = await readPackageManifest(childPackagePath, root);
        if (result.manifest) {
          manifests.push(result.manifest);
        } else {
          findings.push({
            code: DoctorFindingCode.PackageJsonInvalid,
            severity: 'warning',
            message: 'A workspace package.json could not be parsed.',
            evidence: [
              {
                path: relativePath(root, childPackagePath),
                detail: result.detail,
              },
            ],
            remediation:
              'Fix the workspace package.json syntax so package and config checks include it.',
          });
        }
      }
      await visit(childDirectory);
    }
  };

  await visit(root);
  return uniqueBy(manifests, ({ relativePath: manifestPath }) => manifestPath);
}

async function readPackageManifest(
  absolutePath: string,
  root: string
): Promise<{ manifest?: PackageManifest; detail?: string }> {
  const content = await readBoundedTextFile(absolutePath);
  try {
    const data = JSON.parse(content) as PackageJson | undefined;
    if (!data) {
      return { detail: 'empty JSON document' };
    }
    return {
      manifest: {
        absolutePath,
        relativePath: relativePath(root, absolutePath),
        directory: path.dirname(absolutePath),
        data,
      },
    };
  } catch {
    return { detail: 'invalid JSON syntax' };
  }
}

async function discoverConfigFiles(
  root: string,
  manifests: PackageManifest[]
): Promise<ConfigFile[]> {
  const configFiles: ConfigFile[] = [];
  for (const manifest of manifests) {
    const entries = await fs.promises.readdir(manifest.directory, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const match = CONFIG_FILE_PATTERN.exec(entry.name);
      if (!match) continue;
      configFiles.push({
        absolutePath: path.join(manifest.directory, entry.name),
        relativePath: relativePath(root, path.join(manifest.directory, entry.name)),
        bundler: match[1] as SupportedBundler,
        manifest,
      });
    }
  }
  return configFiles.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
}

function detectBundlers(
  manifests: PackageManifest[],
  configs: ConfigFile[]
): DoctorBundlerState[] {
  const bundlers = new Map<SupportedBundler, Set<string>>();
  const packageToBundler: Record<string, SupportedBundler> = {
    '@rsbuild/core': 'rsbuild',
    '@rspack/core': 'rspack',
    webpack: 'webpack',
    vite: 'vite',
    rollup: 'rollup',
    '@rslib/core': 'rslib',
  };

  for (const manifest of manifests) {
    for (const packageName of declaredPackageNames(manifest.data)) {
      const bundler = packageToBundler[packageName];
      if (bundler && !bundlers.has(bundler)) bundlers.set(bundler, new Set());
    }
  }
  for (const config of configs) {
    const paths = bundlers.get(config.bundler) ?? new Set<string>();
    paths.add(config.relativePath);
    bundlers.set(config.bundler, paths);
  }

  return [...bundlers.entries()]
    .map(([name, configFiles]) => ({
      name,
      configFiles: [...configFiles].sort(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function inspectConfigs(
  root: string,
  configFiles: ConfigFile[],
  findings: DoctorFinding[]
): Promise<DoctorConfigState[]> {
  const states: DoctorConfigState[] = [];

  for (const config of configFiles) {
    const source = await readBoundedTextFile(config.absolutePath);
    const zephyrCall = /\bwithZephyr\s*\(/u.exec(source);
    const moduleFederationCall = /\bpluginModuleFederation\s*\(/u.exec(source);
    const assetPrefixMatch = /\bassetPrefix\s*:\s*(['"`])auto\1/u.exec(source);
    const hasAssetPrefix = /\bassetPrefix\s*:/u.test(source);
    const sourceEntry = /\bsource\s*:\s*\{[\s\S]*?\bentry\s*:/u.test(source);
    const exposes = extractPropertyContainer(source, 'exposes');
    const remotes = extractPropertyContainer(source, 'remotes');
    const exposeKeys =
      exposes?.kind === 'object' ? extractTopLevelObjectKeys(exposes.body) : [];
    const remoteKeys =
      remotes?.kind === 'object' ? extractTopLevelObjectKeys(remotes.body) : [];
    const declaredNames = new Set(declaredPackageNames(config.manifest.data));

    if (config.bundler === 'rsbuild') {
      if (!declaredNames.has('zephyr-rsbuild-plugin')) {
        findings.push({
          code: DoctorFindingCode.ZephyrPluginNotDeclared,
          severity: 'error',
          message: 'The Rsbuild package does not declare zephyr-rsbuild-plugin.',
          evidence: [{ path: config.manifest.relativePath }],
          remediation:
            'Add zephyr-rsbuild-plugin with the workspace package manager, then reinstall.',
        });
      }
      if (!zephyrCall) {
        findings.push({
          code: DoctorFindingCode.ZephyrPluginConfigMissing,
          severity: 'error',
          message: 'The Rsbuild config does not call withZephyr().',
          evidence: [{ path: config.relativePath }],
          remediation:
            'Import withZephyr from zephyr-rsbuild-plugin and place withZephyr() after Module Federation.',
        });
      }
      if (
        declaredNames.has('@module-federation/rsbuild-plugin') &&
        !moduleFederationCall
      ) {
        findings.push({
          code: DoctorFindingCode.ModuleFederationPluginConfigMissing,
          severity: 'error',
          message:
            'The package declares the Module Federation Rsbuild plugin but the config does not call it.',
          evidence: [{ path: config.relativePath }],
          remediation:
            'Add pluginModuleFederation(...) to the Rsbuild plugins array before withZephyr().',
        });
      }
      if (
        zephyrCall &&
        moduleFederationCall &&
        zephyrCall.index < moduleFederationCall.index
      ) {
        findings.push({
          code: DoctorFindingCode.ZephyrPluginOrder,
          severity: 'error',
          message: 'withZephyr() appears before pluginModuleFederation().',
          evidence: [
            {
              path: config.relativePath,
              line: lineNumber(source, zephyrCall.index),
            },
          ],
          remediation:
            'Move withZephyr() after pluginModuleFederation() in the plugins array.',
        });
      }
      if (!hasAssetPrefix) {
        findings.push({
          code: DoctorFindingCode.AssetPrefixMissing,
          severity: 'warning',
          message: 'The Rsbuild config does not set output.assetPrefix.',
          evidence: [{ path: config.relativePath }],
          remediation: 'Set output.assetPrefix to "auto" for Zephyr-hosted assets.',
        });
      } else if (!assetPrefixMatch) {
        findings.push({
          code: DoctorFindingCode.AssetPrefixInvalid,
          severity: 'error',
          message: 'The Rsbuild assetPrefix is not set to "auto".',
          evidence: [{ path: config.relativePath }],
          remediation: 'Set output.assetPrefix to "auto".',
        });
      }
      if (!sourceEntry) {
        findings.push({
          code: DoctorFindingCode.SourceEntryMissing,
          severity: 'warning',
          message: 'The Rsbuild config does not declare an explicit source.entry.',
          evidence: [{ path: config.relativePath }],
          remediation:
            'Declare source.entry explicitly so build and federation entry behavior is reproducible.',
        });
      }
    }

    if (exposes?.kind === 'object') {
      for (const exposeKey of exposeKeys.filter((key) => !key.startsWith('./'))) {
        findings.push({
          code: DoctorFindingCode.ExposeKeyInvalid,
          severity: 'error',
          message: 'A Module Federation expose key does not start with "./".',
          evidence: [
            {
              path: config.relativePath,
              detail: `expose key: ${boundedDetail(exposeKey)}`,
            },
          ],
          remediation: 'Prefix exposed module keys with "./", for example "./button".',
        });
      }
    }
    if (remotes?.kind === 'array') {
      findings.push({
        code: DoctorFindingCode.RemotesMustBeObject,
        severity: 'error',
        message: 'Module Federation remotes must use object form.',
        evidence: [{ path: config.relativePath }],
        remediation:
          'Use an object whose keys are stable remote aliases and values are remote definitions.',
      });
    }

    const remoteDependencyKeys = Object.keys(
      config.manifest.data['zephyr:dependencies'] ?? {}
    );
    if (remoteDependencyKeys.length > 0) {
      const missingRemotes = remoteDependencyKeys.filter(
        (key) => !remoteKeys.includes(key)
      );
      const missingDependencies = remoteKeys.filter(
        (key) => !remoteDependencyKeys.includes(key)
      );
      if (missingRemotes.length > 0 || missingDependencies.length > 0) {
        findings.push({
          code: DoctorFindingCode.RemoteDependencyAliasMismatch,
          severity: 'error',
          message:
            'Module Federation remote aliases and zephyr:dependencies keys do not match.',
          evidence: [
            {
              path: config.relativePath,
              detail: boundedDetail(
                [
                  missingRemotes.length
                    ? `missing remotes: ${missingRemotes.join(', ')}`
                    : '',
                  missingDependencies.length
                    ? `missing dependencies: ${missingDependencies.join(', ')}`
                    : '',
                ]
                  .filter(Boolean)
                  .join('; ')
              ),
            },
            { path: config.manifest.relativePath },
          ],
          remediation:
            'Use the same alias keys in Module Federation remotes and package.json zephyr:dependencies.',
        });
      }
    }

    states.push({
      path: config.relativePath,
      bundler: config.bundler,
      zephyrPlugin: Boolean(zephyrCall),
      moduleFederationPlugin: Boolean(moduleFederationCall),
      assetPrefix: assetPrefixMatch ? 'auto' : hasAssetPrefix ? 'other' : 'missing',
      sourceEntry,
      exposes: exposeKeys.sort(),
      remotes: remoteKeys.sort(),
    });
  }

  return states;
}

function inspectBundlerReadiness(
  bundlers: DoctorBundlerState[],
  configs: DoctorConfigState[],
  manifests: PackageManifest[],
  findings: DoctorFinding[]
): void {
  if (bundlers.length === 0) {
    findings.push({
      code: DoctorFindingCode.BundlerNotDetected,
      severity: 'warning',
      message: 'No supported bundler was detected.',
      evidence: [{ path: 'package.json' }],
      remediation:
        'Declare a supported bundler and add its standard config file before publishing.',
    });
  }

  if (
    bundlers.some(({ name }) => name === 'rsbuild') &&
    !configs.some(({ bundler }) => bundler === 'rsbuild')
  ) {
    const rsbuildManifest =
      manifests.find((manifest) =>
        declaredPackageNames(manifest.data).includes('@rsbuild/core')
      ) ?? manifests[0];
    findings.push({
      code: DoctorFindingCode.RsbuildConfigMissing,
      severity: 'error',
      message: 'Rsbuild is declared but no rsbuild.config file was found.',
      evidence: [{ path: rsbuildManifest?.relativePath ?? 'package.json' }],
      remediation: 'Add rsbuild.config.ts using defineConfig.',
    });
  }
}

async function inspectLockfile(
  root: string,
  rootPackage: PackageJson
): Promise<LockState> {
  const candidates: Array<{
    file: string;
    manager: Exclude<PackageManager, 'unknown'>;
  }> = [
    { file: 'pnpm-lock.yaml', manager: 'pnpm' },
    { file: 'package-lock.json', manager: 'npm' },
    { file: 'yarn.lock', manager: 'yarn' },
    { file: 'bun.lock', manager: 'bun' },
    { file: 'bun.lockb', manager: 'bun' },
  ];
  const declaredManager = packageManagerName(rootPackage.packageManager);

  for (const candidate of candidates) {
    const absolutePath = path.join(root, candidate.file);
    if (!(await pathExists(absolutePath))) continue;
    return {
      path: candidate.file,
      packageManager: declaredManager ?? candidate.manager,
      format: candidate.manager,
      versions: new Map(),
      supported: candidate.manager !== 'bun',
    };
  }

  return {
    path: null,
    packageManager: declaredManager ?? 'unknown',
    format: null,
    versions: new Map(),
    supported: true,
  };
}

function inspectLockfileReadiness(lockState: LockState, findings: DoctorFinding[]): void {
  if (!lockState.path) {
    findings.push({
      code: DoctorFindingCode.LockfileMissing,
      severity: 'warning',
      message: 'No supported package-manager lockfile was found.',
      evidence: [{ path: 'package.json' }],
      remediation:
        'Install with the selected package manager and commit its lockfile for reproducible builds.',
    });
  } else if (!lockState.supported) {
    findings.push({
      code: DoctorFindingCode.LockfileUnsupported,
      severity: 'warning',
      message: 'This lockfile format cannot yet be inspected for resolved versions.',
      evidence: [{ path: lockState.path }],
      remediation:
        'Confirm installed versions with the package manager until this lockfile format is supported.',
    });
  }
}

async function inspectPackages(
  root: string,
  manifests: PackageManifest[],
  lockState: LockState,
  findings: DoctorFinding[]
): Promise<DoctorPackageState[]> {
  const declared = new Map<string, Array<{ manifest: PackageManifest; range: string }>>();

  for (const manifest of manifests) {
    for (const [name, range] of declaredPackages(manifest.data)) {
      if (!isRelevantPackage(name)) continue;
      const entries = declared.get(name) ?? [];
      entries.push({ manifest, range });
      declared.set(name, entries);
    }
  }

  if (lockState.path && lockState.supported) {
    lockState.versions = await readLockVersions(
      path.join(root, lockState.path),
      lockState.format ?? lockState.packageManager,
      [...declared.keys()]
    );
  }

  const states: DoctorPackageState[] = [];
  for (const [name, declarations] of [...declared.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const installed = new Map<string, string>();
    for (const declaration of declarations) {
      const installedManifest = await findInstalledPackageManifest(
        declaration.manifest.directory,
        root,
        name
      );
      if (!installedManifest) continue;
      const installedResult = await readPackageManifest(installedManifest, root);
      const version = installedResult.manifest?.data.version;
      if (version) {
        installed.set(relativePath(root, installedManifest), version);
      }
    }

    const locked = [...(lockState.versions.get(name) ?? new Set())].sort();
    const installedEntries = [...installed.entries()]
      .map(([installedPath, version]) => ({ path: installedPath, version }))
      .sort((left, right) => left.path.localeCompare(right.path));

    states.push({
      name,
      declared: declarations
        .map(({ manifest, range }) => ({
          path: manifest.relativePath,
          range: boundedDetail(range),
        }))
        .sort((left, right) => left.path.localeCompare(right.path)),
      locked,
      installed: installedEntries,
    });

    if (installedEntries.length === 0) {
      findings.push({
        code:
          name === 'zephyr-rsbuild-plugin'
            ? DoctorFindingCode.ZephyrPluginNotInstalled
            : DoctorFindingCode.PackageNotInstalled,
        severity: 'warning',
        message: `${name} is declared but no installed package.json was found.`,
        evidence: declarations.map(({ manifest, range }) => ({
          path: manifest.relativePath,
          detail: `declared: ${boundedDetail(range)}`,
        })),
        remediation: 'Run the workspace package-manager install and retry doctor.',
      });
    }

    if (
      locked.length > 0 &&
      installedEntries.some(({ version }) => !locked.includes(version))
    ) {
      findings.push({
        code: DoctorFindingCode.PackageVersionMismatch,
        severity: 'error',
        message: `${name} has different locked and installed versions.`,
        evidence: [
          ...(lockState.path
            ? [
                {
                  path: lockState.path,
                  detail: `locked: ${boundedDetail(locked.join(', '))}`,
                },
              ]
            : []),
          ...installedEntries.map(({ path: installedPath, version }) => ({
            path: installedPath,
            detail: `installed: ${boundedDetail(version)}`,
          })),
        ],
        remediation:
          'Reinstall from the committed lockfile and do not debug against a divergent node_modules tree.',
      });
    }
  }
  return states;
}

async function readLockVersions(
  lockfilePath: string,
  packageManager: PackageManager,
  packageNames: string[]
): Promise<Map<string, Set<string>>> {
  const versions = new Map<string, Set<string>>();
  const content = await readBoundedTextFile(lockfilePath);

  if (packageManager === 'npm') {
    const parsed = JSON.parse(content) as {
      packages?: Record<string, { version?: string }>;
    };
    for (const packageName of packageNames) {
      const version = parsed.packages?.[`node_modules/${packageName}`]?.version;
      if (version) versions.set(packageName, new Set([version]));
    }
    return versions;
  }

  const lines = content.split(/\r?\n/u);
  for (const packageName of packageNames) {
    const found = new Set<string>();
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index] ?? '';
      const key = unquoteYamlKey(line.trim().replace(/:$/u, ''));

      if (packageManager === 'pnpm' && key === packageName) {
        const indent = leadingWhitespace(line);
        for (let next = index + 1; next < lines.length; next++) {
          const candidate = lines[next] ?? '';
          if (candidate.trim() && leadingWhitespace(candidate) <= indent) break;
          const versionMatch = /^\s*version:\s*(['"]?)([^'"\s]+)\1\s*$/u.exec(candidate);
          if (versionMatch?.[2]) found.add(normalizeLockVersion(versionMatch[2]));
        }
      } else if (
        packageManager === 'yarn' &&
        leadingWhitespace(line) === 0 &&
        line.includes(`${packageName}@`) &&
        line.trim().endsWith(':')
      ) {
        for (let next = index + 1; next < lines.length; next++) {
          const candidate = lines[next] ?? '';
          if (candidate.trim() && leadingWhitespace(candidate) === 0) break;
          const versionMatch = /^\s*version\s+(['"]?)([^'"\s]+)\1\s*$/u.exec(candidate);
          if (versionMatch?.[2]) found.add(normalizeLockVersion(versionMatch[2]));
        }
      }
    }
    if (found.size > 0) versions.set(packageName, found);
  }
  return versions;
}

function inspectWatchMode(
  manifests: PackageManifest[],
  bundlers: DoctorBundlerState[],
  findings: DoctorFinding[]
): DoctorWatchState {
  const scriptNames: DoctorWatchState['scriptNames'] = [];
  const scripts: Array<{
    manifest: PackageManifest;
    name: string;
    command: string;
  }> = [];
  let tapProject = false;

  for (const manifest of manifests) {
    const manifestScripts = Object.entries(manifest.data.scripts ?? {});
    const matchedNames = manifestScripts
      .filter(([, command]) => /\b(?:watch|dev)\b/u.test(command))
      .map(([name]) => name)
      .sort();
    if (matchedNames.length > 0) {
      scriptNames.push({ path: manifest.relativePath, names: matchedNames });
    }
    for (const [name, command] of manifestScripts) {
      scripts.push({ manifest, name, command });
      if (command.includes('--target tap-app')) tapProject = true;
    }
    if (
      declaredPackageNames(manifest.data).includes('zephyr-tap-runtime') ||
      manifest.data['zephyr:target'] === 'tap-app'
    ) {
      tapProject = true;
    }
  }

  const zeCliWatchScripts = scripts.filter(({ command }) =>
    /\bze-cli\s+watch\b/u.test(command)
  );
  if (!tapProject) {
    for (const script of zeCliWatchScripts) {
      findings.push({
        code: DoctorFindingCode.WebWatchUsesTapCommand,
        severity: 'error',
        message: 'A web project uses the TAP-only ze-cli watch command.',
        evidence: [
          {
            path: script.manifest.relativePath,
            detail: `script: ${boundedDetail(script.name)}`,
          },
        ],
        remediation:
          'Use "rsbuild build --watch" for web projects. ze-cli watch is reserved for TAP packages.',
      });
    }
    return {
      mode: bundlers.some(({ name }) => name === 'rsbuild') ? 'web' : 'unknown',
      scriptNames,
      recommendedCommand: bundlers.some(({ name }) => name === 'rsbuild')
        ? 'rsbuild build --watch'
        : null,
    };
  }

  for (const script of zeCliWatchScripts) {
    if (!script.command.includes('--target tap-app')) {
      findings.push({
        code: DoctorFindingCode.TapWatchTargetMissing,
        severity: 'error',
        message: 'A TAP watch script is missing --target tap-app.',
        evidence: [
          {
            path: script.manifest.relativePath,
            detail: `script: ${boundedDetail(script.name)}`,
          },
        ],
        remediation: 'Add --target tap-app to the ze-cli watch command.',
      });
    }
    if (!script.command.includes('--metadata')) {
      findings.push({
        code: DoctorFindingCode.TapWatchMetadataMissing,
        severity: 'error',
        message: 'A TAP watch script is missing the publication metadata sidecar.',
        evidence: [
          {
            path: script.manifest.relativePath,
            detail: `script: ${boundedDetail(script.name)}`,
          },
        ],
        remediation: 'Pass --metadata <sidecar.json> to ze-cli watch.',
      });
    }
  }

  return {
    mode: 'tap-app',
    scriptNames,
    recommendedCommand:
      'ze-cli watch ./dist --target tap-app --metadata ./dist/zephyr-publication.json',
  };
}

async function inspectDtsEvidence(
  root: string,
  manifests: PackageManifest[],
  packageManager: PackageManager,
  findings: DoctorFinding[]
): Promise<DoctorDtsState> {
  const logs = new Set<string>();
  const temporaryArtifacts = new Set<string>();
  const typeArchives = new Set<string>();

  for (const manifest of manifests) {
    const logPath = path.join(manifest.directory, '.mf', 'typesGenerate.log');
    if (await pathExists(logPath)) logs.add(relativePath(root, logPath));

    const archivePath = path.join(manifest.directory, 'dist', '@mf-types.zip');
    if (await pathExists(archivePath)) typeArchives.add(relativePath(root, archivePath));

    const federationDirectory = path.join(
      manifest.directory,
      'node_modules',
      '.federation'
    );
    for (const artifact of await listDiagnosticArtifacts(federationDirectory)) {
      temporaryArtifacts.add(relativePath(root, artifact));
    }
  }

  for (const log of logs) {
    const absoluteLog = path.join(root, log);
    const source = await readBoundedTextFile(absoluteLog);
    const diagnosticCodes = [
      ...new Set(source.match(/\b(?:TYPE-\d+|TS6059)\b/gu) ?? []),
    ].sort();
    if (diagnosticCodes.length > 0) {
      findings.push({
        code: DoctorFindingCode.DtsDiagnosticFailure,
        severity: 'error',
        message: 'Module Federation DTS diagnostics contain a known failure code.',
        evidence: [
          {
            path: log,
            detail: `codes: ${diagnosticCodes.join(', ')}`,
          },
        ],
        remediation:
          'Run the reported DTS reproduction command, preserve the temporary tsconfig, and inspect .mf/typesGenerate.log before disabling DTS.',
      });
    }
  }

  const packageCommand = packageManager === 'unknown' ? 'pnpm' : packageManager;
  return {
    logs: [...logs].sort(),
    temporaryArtifacts: [...temporaryArtifacts].sort(),
    typeArchives: [...typeArchives].sort(),
    diagnosticCommands: [
      `FEDERATION_DEBUG=true ${packageCommand} run build`,
      `${packageCommand} exec rsbuild inspect`,
    ],
  };
}

async function listDiagnosticArtifacts(directory: string): Promise<string[]> {
  if (!(await pathExists(directory))) return [];
  const artifacts: string[] = [];
  const visit = async (current: string): Promise<void> => {
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (
        /\.(?:json|jsonc|log|ts)$/u.test(entry.name) ||
        entry.name.includes('tsconfig')
      ) {
        artifacts.push(absolutePath);
      }
    }
  };
  await visit(directory);
  return artifacts;
}

function declaredPackages(packageJson: PackageJson): Array<[string, string]> {
  return Object.entries({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.optionalDependencies,
    ...packageJson.peerDependencies,
  });
}

function declaredPackageNames(packageJson: PackageJson): string[] {
  return declaredPackages(packageJson).map(([name]) => name);
}

function isRelevantPackage(name: string): boolean {
  return (
    name === 'typescript' ||
    name === 'webpack' ||
    name === 'vite' ||
    name === 'rollup' ||
    name.startsWith('zephyr-') ||
    name.startsWith('@zephyr-cloud/') ||
    name.startsWith('@zephyrcloudio/') ||
    name.startsWith('@module-federation/') ||
    name.startsWith('@rsbuild/') ||
    name.startsWith('@rspack/') ||
    name.startsWith('@rslib/')
  );
}

async function findInstalledPackageManifest(
  fromDirectory: string,
  root: string,
  packageName: string
): Promise<string | undefined> {
  let current = fromDirectory;
  while (current === root || current.startsWith(`${root}${path.sep}`)) {
    const candidate = path.join(current, 'node_modules', packageName, 'package.json');
    if (await pathExists(candidate)) return candidate;
    if (current === root) break;
    current = path.dirname(current);
  }
  return undefined;
}

function packageManagerName(value: string | undefined): PackageManager | undefined {
  const name = value?.split('@')[0];
  return name === 'pnpm' || name === 'npm' || name === 'yarn' || name === 'bun'
    ? name
    : undefined;
}

function extractPropertyContainer(
  source: string,
  propertyName: string
): PropertyContainer | undefined {
  const propertyMatch = new RegExp(`\\b${propertyName}\\s*:`, 'u').exec(source);
  if (!propertyMatch) return undefined;

  let cursor = propertyMatch.index + propertyMatch[0].length;
  while (/\s/u.test(source[cursor] ?? '')) cursor += 1;
  const opener = source[cursor];
  if (opener !== '{' && opener !== '[') return undefined;
  const closer = opener === '{' ? '}' : ']';
  const end = findMatchingDelimiter(source, cursor, opener, closer);
  if (end === -1) return undefined;
  return {
    kind: opener === '{' ? 'object' : 'array',
    body: source.slice(cursor + 1, end),
    start: cursor,
  };
}

function findMatchingDelimiter(
  source: string,
  start: number,
  opener: string,
  closer: string
): number {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < source.length; index++) {
    const character = source[index] ?? '';
    const next = source[index + 1] ?? '';
    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === opener) depth += 1;
    if (character === closer) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function extractTopLevelObjectKeys(body: string): string[] {
  const depths = nestingDepths(body);
  const keys = new Set<string>();
  const pattern = /(?:^|,|\n)\s*(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$.-]*))\s*:/gu;
  for (const match of body.matchAll(pattern)) {
    if (depths[match.index ?? 0] === 0) {
      const key = match[1] ?? match[2];
      if (key) keys.add(key);
    }
  }
  return [...keys];
}

function nestingDepths(source: string): number[] {
  const depths = Array.from({ length: source.length }, () => 0);
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;

  for (let index = 0; index < source.length; index++) {
    depths[index] = depth;
    const character = source[index] ?? '';
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
    } else if (character === '{' || character === '[' || character === '(') {
      depth += 1;
    } else if (character === '}' || character === ']' || character === ')') {
      depth = Math.max(0, depth - 1);
    }
  }
  return depths;
}

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

async function readBoundedTextFile(absolutePath: string): Promise<string> {
  const stats = await fs.promises.stat(absolutePath);
  if (stats.size > MAX_TEXT_FILE_BYTES) {
    throw new Error(`Refusing to inspect a file larger than ${MAX_TEXT_FILE_BYTES}.`);
  }
  return fs.promises.readFile(absolutePath, 'utf8');
}

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.promises.access(absolutePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function relativePath(root: string, absolutePath: string): string {
  const relative = path.relative(root, absolutePath) || '.';
  return relative.split(path.sep).join('/');
}

function leadingWhitespace(value: string): number {
  return /^\s*/u.exec(value)?.[0].length ?? 0;
}

function unquoteYamlKey(value: string): string {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeLockVersion(value: string): string {
  return value.replace(/^npm:/u, '').split('(')[0] ?? value;
}

function boundedDetail(value: string): string {
  const redacted = value
    .replace(/([a-z][a-z\d+.-]*:\/\/)[^/@\s]+@/giu, '$1[redacted]@')
    .replace(/([?&](?:token|key|secret|password)=)[^&\s]+/giu, '$1[redacted]')
    .replace(/\b(?:token|secret|password|authorization)\s*[:=]\s*\S+/giu, '[redacted]')
    .replace(/\bbearer\s+\S+/giu, 'Bearer [redacted]');
  return redacted.length <= 240 ? redacted : `${redacted.slice(0, 237)}...`;
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const identity = key(value);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
