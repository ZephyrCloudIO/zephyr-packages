import { access, constants } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  ZephyrEngine,
  logFn,
  ZephyrError,
  ZeErrors,
  isZephyrDisabled,
  ZE_DISABLED_MESSAGE,
} from 'zephyr-agent';
import type { ZephyrBuildTarget } from 'zephyr-edge-contract';
import {
  buildAssetsMapFromSelection,
  selectDirectoryFiles,
  warnAboutBlockedFiles,
  type DirectorySelection,
} from '../lib/extract-assets';
import type { ExcludedFile } from '../lib/file-selection';
import { assertRelativePathOrGlob } from '../lib/path-rules';
import { loadPublicationMetadata } from '../lib/publication-metadata';
import { uploadAssets } from '../lib/upload';
import { loadZephyrConfig, resolveConfigPath } from '../lib/zephyr-config';

export interface DeployOptions {
  directory: string;
  target?: ZephyrBuildTarget;
  verbose?: boolean;
  ssr?: boolean;
  /** JSON sidecar emitted by a TAP SDK or compatible bundler. */
  metadataPath?: string;
  /**
   * `--config`: path of a zephyr.config.json, instead of
   * `<directory>/zephyr.config.json`.
   */
  configPath?: string;
  /** `--include`: replaces the config's include globs. */
  include?: string[];
  /** `--exclude`: replaces the config's exclude globs. */
  exclude?: string[];
  /** `--output`: replaces the config's upload root, relative to the config's folder. */
  output?: string;
  /** List what would be uploaded and stop, before any sign-in or network request. */
  dryRun?: boolean;
  /** Output format of the CLI; the no-config hint is not printed for `json`. */
  format?: 'json' | 'text';
  cwd: string;
}

/** What `deploy --dry-run` returns. Nothing was read by Zephyr or uploaded. */
export interface DeployDryRunResult {
  dryRun: true;
  root: string;
  files: { path: string; size: number }[];
  excluded: ExcludedFile[];
  fileCount: number;
  totalSize: number;
  /** Set when no file was selected; the CLI then exits with a non-zero status. */
  nothingToUpload?: string;
}

/** Everything `deploy` decides before it reads a file. */
export interface DeployPlan {
  root: string;
  target?: ZephyrBuildTarget;
  metadataPath?: string;
  include?: string[];
  exclude?: string[];
  /** Whether a zephyr.config.json was found and used. */
  configured: boolean;
}

const FLAGS_WITHOUT_CONFIG_HINT =
  'No zephyr.config.json found: the --include, --exclude and --output flags choose the files for this run only. Add a zephyr.config.json to keep the choice in the repository (see ze-cli --help).';

const NO_CONFIG_HINT =
  'No zephyr.config.json found: uploading the whole folder, minus common build leftovers and sensitive files. Add a zephyr.config.json to choose the files explicitly (see ze-cli --help).';

function normalizeSlashes(path: string): string {
  return path.split('\\').join('/');
}

/**
 * Resolves config file, CLI flags and defaults into one plan. Precedence: CLI flags, then
 * the config file, then the legacy behavior (upload the whole folder).
 */
export async function resolveDeployPlan(
  options: DeployOptions,
  directoryPath: string
): Promise<DeployPlan> {
  if (options.output !== undefined) assertRelativePathOrGlob(options.output, '--output');
  for (const glob of options.include ?? []) assertRelativePathOrGlob(glob, '--include');
  for (const glob of options.exclude ?? []) assertRelativePathOrGlob(glob, '--exclude');

  const location = resolveConfigPath(directoryPath, options.configPath, options.cwd);
  if (location.explicit) {
    const fromDirectory = relative(directoryPath, location.path);
    if (
      fromDirectory === '..' ||
      fromDirectory.startsWith(`..${sep}`) ||
      isAbsolute(fromDirectory)
    ) {
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: `--config must point to a file inside the deploy directory ${directoryPath}, but it points to ${location.path}. The directory argument decides where the upload happens; pass the folder that holds the config instead.`,
      });
    }
  }
  const config = await loadZephyrConfig(location);

  const baseDirectory = config === undefined ? directoryPath : dirname(location.path);
  const output = options.output ?? config?.output;
  const root = output === undefined ? baseDirectory : resolve(baseDirectory, output);
  const include = options.include ?? config?.include;
  let exclude = options.exclude ?? config?.exclude;

  if (include === undefined && exclude !== undefined) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message:
        '--exclude needs --include or a zephyr.config.json that lists include globs.',
    });
  }

  // The config file describes the upload; it is never part of it.
  if (config !== undefined) {
    const configRelative = relative(root, location.path);
    if (!configRelative.startsWith('..') && !isAbsolute(configRelative)) {
      exclude = [...(exclude ?? []), normalizeSlashes(configRelative)];
    }
  }

  const configMetadata =
    config?.metadata === undefined
      ? undefined
      : resolve(dirname(location.path), config.metadata);

  const target = options.target ?? config?.target;
  const metadataPath = options.metadataPath ?? configMetadata;
  return {
    root,
    configured: config !== undefined,
    ...(target === undefined ? {} : { target }),
    ...(metadataPath === undefined ? {} : { metadataPath }),
    ...(include === undefined ? {} : { include }),
    ...(exclude === undefined ? {} : { exclude }),
  };
}

/** Why an empty selection is an error, naming the globs that matched nothing. */
export function describeEmptySelection(plan: DeployPlan): string {
  const where = `in ${plan.root}`;
  if (plan.include === undefined) {
    return `Nothing to upload: every file ${where} was skipped by the built-in rules.`;
  }
  return `Nothing to upload: no file ${where} matched include ${JSON.stringify(plan.include)}. Check the globs and the output folder.`;
}

function toDryRunResult(
  root: string,
  selection: DirectorySelection,
  plan: DeployPlan
): DeployDryRunResult {
  const files = selection.files.map(({ path, size }) => ({ path, size }));
  return {
    dryRun: true,
    root,
    files,
    excluded: selection.excluded,
    fileCount: files.length,
    totalSize: files.reduce((total, file) => total + file.size, 0),
    ...(files.length === 0 ? { nothingToUpload: describeEmptySelection(plan) } : {}),
  };
}

/** What `deploy --format json` prints. */
export interface DeployResult {
  applicationUid: string;
  /** The immutable URL of this version, or `null` when Zephyr returned none. */
  versionUrl: string | null;
  /** Tag and environment URLs this version now serves. */
  targetUrls: string[];
}

/** What `deploy --format json` prints when `ZE_DISABLED=true` skipped the deployment. */
export interface DeploySkippedResult {
  skipped: true;
  reason: 'ZE_DISABLED';
}

/**
 * Deploy command: Upload pre-built assets from a directory to Zephyr. This is similar to
 * the standalone zephyr-cli tool.
 */
export async function deployCommand(
  options: DeployOptions
): Promise<DeployResult | DeploySkippedResult | DeployDryRunResult> {
  const { directory, verbose, ssr, cwd } = options;

  // Resolve the directory path
  const directoryPath = resolve(cwd, directory);

  // Check if directory exists
  try {
    await access(directoryPath, constants.F_OK);
  } catch {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Directory does not exist: ${directoryPath}`,
    });
  }

  const plan = await resolveDeployPlan(options, directoryPath);
  const { root, target, metadataPath } = plan;

  try {
    await access(root, constants.F_OK);
  } catch {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `Upload folder does not exist: ${root}`,
    });
  }

  if (!plan.configured && options.format !== 'json') {
    const usesFlags =
      options.include !== undefined ||
      options.exclude !== undefined ||
      options.output !== undefined;
    logFn('info', usesFlags ? FLAGS_WITHOUT_CONFIG_HINT : NO_CONFIG_HINT);
  }

  const selectionOptions = {
    target,
    workerConfigGuard: { hasConfig: plan.configured },
    ...(plan.include === undefined ? {} : { include: plan.include }),
    ...(plan.exclude === undefined ? {} : { exclude: plan.exclude }),
  };

  // Dry run: the same selection as the upload below, then stop. Nothing here signs in,
  // creates an engine or touches the network.
  if (options.dryRun) {
    // The sidecar is a local file; reading it here makes a bad one fail the dry run too.
    await loadPublicationMetadata({ metadataPath, cwd, target });
    return toDryRunResult(root, await selectDirectoryFiles(root, selectionOptions), plan);
  }

  // Skip mode: nothing is read, authenticated or sent to Zephyr.
  if (isZephyrDisabled()) {
    logFn('warn', ZE_DISABLED_MESSAGE);
    return { skipped: true, reason: 'ZE_DISABLED' };
  }

  if (verbose) {
    logFn('info', `Uploading assets from: ${root}`);
  }

  // Validate the SDK sidecar before opening a build session. A TAP publication must
  // never reach the upload lifecycle without its typed Federation contract.
  const publicationMetadata = await loadPublicationMetadata({
    metadataPath,
    cwd,
    target,
  });

  // Select before creating the engine: a refusal (secrets, source files, an unconfigured
  // Wrangler config) must stop the run before any session or request exists.
  if (verbose) {
    logFn('info', 'Extracting assets from directory...');
  }
  const selection = await selectDirectoryFiles(root, selectionOptions);
  warnAboutBlockedFiles(selection.excluded);
  if (selection.files.length === 0) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: describeEmptySelection(plan),
    });
  }
  const assetsMap = buildAssetsMapFromSelection(selection.files);

  // Initialize ZephyrEngine with project root context
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'unknown',
    context: cwd,
    ...(target === undefined ? {} : { target }),
  });

  // Set SSR flag if specified
  if (ssr) {
    zephyr_engine.env.ssr = true;
  }

  if (verbose) {
    const assetCount = Object.keys(assetsMap).length;
    logFn('info', `Found ${assetCount} assets to upload`);
  }

  // Upload assets
  const uploaded = await uploadAssets({
    zephyr_engine,
    assetsMap,
    publicationMetadata,
  });

  if (verbose) {
    logFn('info', 'Upload completed successfully');
  }

  return { applicationUid: zephyr_engine.application_uid, ...uploaded };
}
