import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PackageManager, ResolvedCliOptions } from './cli.js';
import {
  getTemplate,
  TemplateRepositories,
  type TemplateRepository,
} from './templates.js';

export type ScaffoldStage =
  | 'prepare'
  | 'fetch-template'
  | 'copy-template'
  | 'git'
  | 'install'
  | 'build'
  | 'inspect';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunnerOptions {
  cwd: string;
  timeoutMs?: number;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options: CommandRunnerOptions
) => Promise<CommandResult>;

export interface CommandReceipt {
  stage: ScaffoldStage;
  command: string;
  args: string[];
  cwd: string;
  exitCode: number;
}

export interface ScaffoldFailureReceipt {
  stage: ScaffoldStage;
  message: string;
  exitCode: number;
  stderr?: string;
}

export interface ResolvedPackageVersion {
  name: string;
  version: string;
  source: 'workspace' | 'installed';
}

export interface ScaffoldReceipt {
  success: boolean;
  directory: string;
  projectType: ResolvedCliOptions['projectType'];
  template: string | null;
  templateRepository: string;
  templateRevision: string;
  packageManager: {
    name: PackageManager;
    version: string | null;
  };
  createdFiles: string[];
  artifacts: string[];
  resolvedPackageVersions: ResolvedPackageVersion[];
  commands: CommandReceipt[];
  failures: ScaffoldFailureReceipt[];
}

export interface ScaffoldDependencies {
  runCommand?: CommandRunner;
  repositories?: Partial<Record<ResolvedCliOptions['projectType'], TemplateRepository>>;
  onProgress?: (stage: ScaffoldStage, message: string) => void;
  removeTemporaryDirectory?: (directory: string) => Promise<void>;
}

export class ScaffoldFailure extends Error {
  readonly exitCode: number;
  readonly receipt: ScaffoldReceipt;

  constructor(message: string, exitCode: number, receipt: ScaffoldReceipt) {
    super(message);
    this.name = 'ScaffoldFailure';
    this.exitCode = exitCode;
    this.receipt = receipt;
  }
}

class CommandFailure extends Error {
  readonly stage: ScaffoldStage;
  readonly result: CommandResult;

  constructor(stage: ScaffoldStage, command: string, result: CommandResult) {
    super(`${command} exited with code ${result.exitCode}.`);
    this.name = 'CommandFailure';
    this.stage = stage;
    this.result = result;
  }
}

/** @internal */
export function normalizeReceiptPath(value: string): string {
  return value.replaceAll(path.win32.sep, path.posix.sep);
}

export const TEMPLATE_FETCH_TIMEOUT_MS = 5 * 60 * 1_000;
const COMMAND_TERMINATION_GRACE_MS = 5_000;

export async function defaultCommandRunner(
  command: string,
  args: string[],
  options: CommandRunnerOptions
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, NO_COLOR: '1' },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let timeout: NodeJS.Timeout | undefined;
    let forceKillTimeout: NodeJS.Timeout | undefined;

    const settle = (result: CommandResult): void => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (forceKillTimeout) clearTimeout(forceKillTimeout);
      resolve(result);
    };

    const timeoutStderr = (): string => {
      const timeoutMessage = `Command timed out after ${options.timeoutMs}ms.`;
      return `${stderr}${stderr ? '\n' : ''}${timeoutMessage}`;
    };

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });

    if (options.timeoutMs !== undefined) {
      timeout = setTimeout(() => {
        timedOut = true;
        if (!child.kill('SIGTERM')) {
          settle({ exitCode: 124, stdout, stderr: timeoutStderr() });
          return;
        }
        forceKillTimeout = setTimeout(() => {
          child.kill('SIGKILL');
        }, COMMAND_TERMINATION_GRACE_MS);
      }, options.timeoutMs);
    }

    child.on('error', (error) => {
      settle({
        exitCode: timedOut
          ? 124
          : (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? 127
            : 1,
        stdout,
        stderr: timedOut
          ? timeoutStderr()
          : `${stderr}${stderr ? '\n' : ''}${error.message}`,
      });
    });

    child.on('close', (code) => {
      settle({
        exitCode: timedOut ? 124 : (code ?? 1),
        stdout,
        stderr: timedOut ? timeoutStderr() : stderr,
      });
    });
  });
}

export async function scaffoldProject(
  options: ResolvedCliOptions,
  dependencies: ScaffoldDependencies = {}
): Promise<ScaffoldReceipt> {
  const outputDirectory = path.resolve(options.directory);
  const repository = {
    ...TemplateRepositories[options.projectType],
    ...dependencies.repositories?.[options.projectType],
  };
  let packageManager = options.packageManager ?? 'pnpm';
  const receipt: ScaffoldReceipt = {
    success: false,
    directory: normalizeReceiptPath(outputDirectory),
    projectType: options.projectType,
    template: options.template ?? null,
    templateRepository: repository.url,
    templateRevision: options.templateRevision,
    packageManager: { name: packageManager, version: null },
    createdFiles: [],
    artifacts: [],
    resolvedPackageVersions: [],
    commands: [],
    failures: [],
  };
  const runCommand = dependencies.runCommand ?? defaultCommandRunner;
  const progress = dependencies.onProgress ?? (() => undefined);
  let temporaryDirectory: string | undefined;
  let outputMutationStarted = false;
  let currentStage: ScaffoldStage = 'prepare';
  const reportProgress = (stage: ScaffoldStage, message: string): void => {
    currentStage = stage;
    progress(stage, message);
  };

  const execute = async (
    stage: ScaffoldStage,
    command: string,
    args: string[],
    cwd: string,
    commandOptions: Omit<CommandRunnerOptions, 'cwd'> = {}
  ): Promise<CommandResult> => {
    const result = await runCommand(command, args, { cwd, ...commandOptions });
    receipt.commands.push({
      stage,
      command,
      args,
      cwd: normalizeReceiptPath(cwd),
      exitCode: result.exitCode,
    });
    if (result.exitCode !== 0) {
      throw new CommandFailure(stage, command, result);
    }
    return result;
  };

  try {
    reportProgress('prepare', 'Validating the project directory');
    await assertEmptyOutputDirectory(outputDirectory);

    temporaryDirectory = await fs.promises.mkdtemp(
      path.join(tmpdir(), 'create-zephyr-apps-')
    );
    const checkoutDirectory = path.join(temporaryDirectory, repository.name);
    await fs.promises.mkdir(checkoutDirectory, { recursive: true });

    reportProgress(
      'fetch-template',
      `Fetching ${repository.name} at ${options.templateRevision}`
    );
    await execute('fetch-template', 'git', ['init', '--quiet'], checkoutDirectory);
    await execute(
      'fetch-template',
      'git',
      ['remote', 'add', 'origin', repository.url],
      checkoutDirectory
    );
    await execute(
      'fetch-template',
      'git',
      ['fetch', '--quiet', '--depth', '1', 'origin', options.templateRevision],
      checkoutDirectory,
      { timeoutMs: TEMPLATE_FETCH_TIMEOUT_MS }
    );
    await execute(
      'fetch-template',
      'git',
      ['checkout', '--quiet', '--detach', 'FETCH_HEAD'],
      checkoutDirectory
    );
    const revisionResult = await execute(
      'fetch-template',
      'git',
      ['rev-parse', 'HEAD'],
      checkoutDirectory
    );
    const resolvedRevision = revisionResult.stdout.trim();
    if (resolvedRevision.toLowerCase() !== options.templateRevision.toLowerCase()) {
      throw new Error(
        `Fetched template revision ${resolvedRevision}, expected ${options.templateRevision}.`
      );
    }
    receipt.templateRevision = resolvedRevision;

    const sourceDirectory = resolveTemplateSource(options, checkoutDirectory);
    await fs.promises.access(sourceDirectory, fs.constants.R_OK);

    reportProgress('copy-template', `Copying the template to ${outputDirectory}`);
    await fs.promises.mkdir(outputDirectory, { recursive: true });
    outputMutationStarted = true;
    await fs.promises.cp(sourceDirectory, outputDirectory, {
      recursive: true,
      force: false,
      dereference: true,
      filter(source) {
        return path.basename(source) !== '.git';
      },
    });
    await refreshReceiptFiles(outputDirectory, receipt);
    if (!options.packageManager) {
      packageManager = await detectPackageManager(
        outputDirectory,
        process.cwd(),
        process.env
      );
      receipt.packageManager.name = packageManager;
    }

    if (options.initializeGit) {
      reportProgress('git', 'Initializing the Git repository');
      await execute('git', 'git', ['init'], outputDirectory);
    }

    let beforeBuild = new Set(await listProjectFiles(outputDirectory));
    if (options.install) {
      reportProgress('install', `Installing dependencies with ${packageManager}`);
      const packageManagerMetadataWasReconciled = options.packageManager
        ? await removeConflictingPackageManagerMetadata(outputDirectory, packageManager)
        : false;
      const versionResult = await execute(
        'install',
        packageManager,
        ['--version'],
        outputDirectory
      );
      receipt.packageManager.version = versionResult.stdout.trim() || null;
      if (
        packageManagerMetadataWasReconciled &&
        receipt.packageManager.version !== null
      ) {
        await writePackageManagerMetadata(
          outputDirectory,
          packageManager,
          receipt.packageManager.version
        );
      }
      const installCommand = packageManagerCommands(packageManager).install;
      await execute(
        'install',
        installCommand.command,
        installCommand.args,
        outputDirectory
      );
      await refreshReceiptFiles(outputDirectory, receipt);
      beforeBuild = new Set(await listProjectFiles(outputDirectory));
    }

    if (options.initializeGit) {
      reportProgress('git', 'Creating the initial Git commit');
      await execute('git', 'git', ['add', '.'], outputDirectory);
      await execute(
        'git',
        'git',
        [
          '-c',
          'user.email=zephyrbot@zephyr-cloud.io',
          '-c',
          'user.name=Zephyr Bot',
          'commit',
          '--no-gpg-sign',
          '-m',
          'Initial commit from Zephyr',
        ],
        outputDirectory
      );
    }

    if (options.build) {
      reportProgress('build', `Building the project with ${packageManager}`);
      const buildCommand = packageManagerCommands(packageManager).build;
      await execute('build', buildCommand.command, buildCommand.args, outputDirectory);
      receipt.artifacts = (await listProjectFiles(outputDirectory)).filter(
        (file) => !beforeBuild.has(file)
      );
    }

    reportProgress('inspect', 'Collecting scaffold results');
    await refreshReceiptFiles(outputDirectory, receipt);
    receipt.resolvedPackageVersions =
      await collectResolvedPackageVersions(outputDirectory);
    receipt.success = true;
    return receipt;
  } catch (error) {
    const commandFailure = error instanceof CommandFailure ? error : undefined;
    const exitCode = commandFailure?.result.exitCode ?? 1;
    const message = error instanceof Error ? error.message : String(error);
    if (outputMutationStarted) {
      await refreshReceiptFiles(outputDirectory, receipt).catch(() => undefined);
    }
    receipt.failures.push({
      stage: commandFailure?.stage ?? currentStage,
      message,
      exitCode,
      stderr: commandFailure
        ? tail(commandFailure.result.stderr.trim(), 4_000)
        : undefined,
    });
    throw new ScaffoldFailure(message, exitCode, receipt);
  } finally {
    if (temporaryDirectory) {
      const removeTemporaryDirectory =
        dependencies.removeTemporaryDirectory ??
        ((directory: string) =>
          fs.promises.rm(directory, {
            recursive: true,
            force: true,
          }));
      try {
        await removeTemporaryDirectory(temporaryDirectory);
      } catch {
        // Temporary cleanup must never replace a successful receipt or primary failure.
      }
    }
  }
}

export async function detectPackageManager(
  outputDirectory: string,
  invocationDirectory: string,
  environment: NodeJS.ProcessEnv
): Promise<PackageManager> {
  const packageManagerFromOutput = await readPackageManagerField(outputDirectory);
  if (packageManagerFromOutput) return packageManagerFromOutput;

  const outputLockfile = await detectLockfile(outputDirectory);
  if (outputLockfile) return outputLockfile;

  const userAgent = environment['npm_config_user_agent']
    ?.trim()
    .split(/\s+/u)[0]
    ?.split(/[/@]/u)[0];
  if (isPackageManager(userAgent)) return userAgent;

  const packageManagerFromInvocation = await readPackageManagerField(invocationDirectory);
  if (packageManagerFromInvocation) return packageManagerFromInvocation;

  const invocationLockfile = await detectLockfile(invocationDirectory);
  return invocationLockfile ?? 'pnpm';
}

function resolveTemplateSource(
  options: ResolvedCliOptions,
  checkoutDirectory: string
): string {
  if (options.projectType === 'react-native') {
    return checkoutDirectory;
  }

  const template = options.template ? getTemplate(options.template) : undefined;
  if (!template) {
    throw new Error(`Unknown web template "${String(options.template)}".`);
  }
  return path.join(
    checkoutDirectory,
    template.directory,
    template.sourceName ?? template.name
  );
}

async function assertEmptyOutputDirectory(outputDirectory: string): Promise<void> {
  try {
    const stats = await fs.promises.stat(outputDirectory);
    if (!stats.isDirectory()) {
      throw new Error(`${outputDirectory} exists and is not a directory.`);
    }
    const files = await fs.promises.readdir(outputDirectory);
    if (files.length > 0) {
      throw new Error(
        `Output directory ${outputDirectory} must be empty. Existing files were not changed.`
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

function packageManagerCommands(packageManager: PackageManager): {
  install: { command: string; args: string[] };
  build: { command: string; args: string[] };
} {
  return {
    install: { command: packageManager, args: ['install'] },
    build: { command: packageManager, args: ['run', 'build'] },
  };
}

interface MutablePackageManifest {
  packageManager?: unknown;
  [key: string]: unknown;
}

async function removeConflictingPackageManagerMetadata(
  directory: string,
  selectedPackageManager: PackageManager
): Promise<boolean> {
  const packageManifest = await readMutablePackageManifest(directory);
  if (!packageManifest) return false;

  const declaredPackageManager =
    typeof packageManifest.manifest.packageManager === 'string'
      ? packageManifest.manifest.packageManager.split('@')[0]
      : undefined;
  if (
    !Object.hasOwn(packageManifest.manifest, 'packageManager') ||
    declaredPackageManager === selectedPackageManager
  ) {
    return false;
  }

  delete packageManifest.manifest.packageManager;
  await writeMutablePackageManifest(packageManifest);
  return true;
}

async function writePackageManagerMetadata(
  directory: string,
  packageManager: PackageManager,
  version: string
): Promise<void> {
  const packageManifest = await readMutablePackageManifest(directory);
  if (!packageManifest) return;

  packageManifest.manifest.packageManager = `${packageManager}@${version}`;
  await writeMutablePackageManifest(packageManifest);
}

async function readMutablePackageManifest(directory: string): Promise<
  | {
      path: string;
      source: string;
      manifest: MutablePackageManifest;
    }
  | undefined
> {
  const manifestPath = path.join(directory, 'package.json');
  try {
    const source = await fs.promises.readFile(manifestPath, 'utf8');
    return {
      path: manifestPath,
      source,
      manifest: JSON.parse(source) as MutablePackageManifest,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function writeMutablePackageManifest(packageManifest: {
  path: string;
  source: string;
  manifest: MutablePackageManifest;
}): Promise<void> {
  const indentation = packageManifest.source.match(/\n([ \t]+)"/u)?.[1] ?? '  ';
  const trailingNewline = packageManifest.source.endsWith('\n') ? '\n' : '';
  await fs.promises.writeFile(
    packageManifest.path,
    `${JSON.stringify(packageManifest.manifest, null, indentation)}${trailingNewline}`
  );
}

async function readPackageManagerField(
  directory: string
): Promise<PackageManager | undefined> {
  try {
    const manifest = JSON.parse(
      await fs.promises.readFile(path.join(directory, 'package.json'), 'utf8')
    ) as { packageManager?: string };
    const name = manifest.packageManager?.split('@')[0];
    return isPackageManager(name) ? name : undefined;
  } catch {
    return undefined;
  }
}

async function detectLockfile(directory: string): Promise<PackageManager | undefined> {
  const lockfiles: Array<[string, PackageManager]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['package-lock.json', 'npm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
  ];

  for (const [lockfile, packageManager] of lockfiles) {
    try {
      await fs.promises.access(path.join(directory, lockfile));
      return packageManager;
    } catch {
      // Keep looking.
    }
  }
  return undefined;
}

function isPackageManager(value: string | undefined): value is PackageManager {
  return value === 'pnpm' || value === 'npm' || value === 'yarn' || value === 'bun';
}

async function listProjectFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  const visit = async (directory: string): Promise<void> => {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else {
        files.push(normalizeReceiptPath(path.relative(root, absolutePath)));
      }
    }
  };

  await visit(root);
  return files.sort();
}

async function refreshReceiptFiles(
  outputDirectory: string,
  receipt: ScaffoldReceipt
): Promise<void> {
  const allFiles = await listProjectFiles(outputDirectory);
  const artifacts = new Set(receipt.artifacts);
  receipt.createdFiles = allFiles.filter((file) => !artifacts.has(file));
}

/** @internal */
export async function collectResolvedPackageVersions(
  root: string
): Promise<ResolvedPackageVersion[]> {
  const manifests = await findWorkspaceManifests(root);
  const versions = new Map<string, ResolvedPackageVersion>();

  for (const manifestPath of manifests) {
    let manifest: {
      name?: string;
      version?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    try {
      manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
    } catch {
      continue;
    }

    if (manifest.name && manifest.version) {
      versions.set(`workspace:${manifest.name}@${manifest.version}`, {
        name: manifest.name,
        version: manifest.version,
        source: 'workspace',
      });
    }

    const dependencyNames = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
    ]);
    for (const dependencyName of dependencyNames) {
      const installedManifest = await findInstalledManifest(
        path.dirname(manifestPath),
        root,
        dependencyName
      );
      if (!installedManifest) continue;
      try {
        const dependencyManifest = JSON.parse(
          await fs.promises.readFile(installedManifest, 'utf8')
        ) as { name?: string; version?: string };
        if (dependencyManifest.name && dependencyManifest.version) {
          versions.set(
            `installed:${dependencyManifest.name}@${dependencyManifest.version}`,
            {
              name: dependencyManifest.name,
              version: dependencyManifest.version,
              source: 'installed',
            }
          );
        }
      } catch {
        // A malformed installed package is reported by the package manager/build.
      }
    }
  }

  return [...versions.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name) ||
      left.source.localeCompare(right.source) ||
      left.version.localeCompare(right.version)
  );
}

async function findWorkspaceManifests(root: string): Promise<string[]> {
  const manifests: string[] = [];
  const excludedDirectories = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    'out',
    '.output',
  ]);

  const visit = async (directory: string): Promise<void> => {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) {
          await visit(path.join(directory, entry.name));
        }
      } else if (entry.name === 'package.json') {
        manifests.push(path.join(directory, entry.name));
      }
    }
  };

  await visit(root);
  return manifests;
}

async function findInstalledManifest(
  fromDirectory: string,
  root: string,
  packageName: string
): Promise<string | undefined> {
  let current = fromDirectory;

  while (current.startsWith(root)) {
    const candidate = path.join(current, 'node_modules', packageName, 'package.json');
    try {
      await fs.promises.access(candidate);
      return candidate;
    } catch {
      // Search the next workspace ancestor.
    }

    if (current === root) break;
    current = path.dirname(current);
  }
  return undefined;
}

function tail(value: string, maximumLength: number): string {
  return value.length <= maximumLength
    ? value
    : value.slice(value.length - maximumLength);
}
