import {
  ZeErrors,
  ZephyrEngine,
  ZephyrError,
  buildAssetsMap,
  logFn,
  type ZeBuildAssetsMap,
} from 'zephyr-agent';
import type { EvalResults, ZephyrBuildTarget } from 'zephyr-edge-contract';
import type { DoctorFinding } from '../doctor/schema';
import { getZephyrCliVersion } from '../lib/cli-version';
import { uploadAssets } from '../lib/upload';
import { classifyMcpDirectory, type McpClassification } from './classify';
import { loadEvalResults } from './eval-results';
import { formatFindingLines } from './findings';
import { inspectProviderArtifact } from './provider-artifact';
import {
  buildSkillsRepoArtifact,
  checkSkillsRepoArtifact,
  scanSkillsRepo,
} from './skills-repo';

export interface McpDeployOptions {
  directoryPath: string;
  classification: Exclude<McpClassification, { kind: 'legacy' }>;
  target?: ZephyrBuildTarget;
  ssr?: boolean;
  metadataPath?: string;
  evalResultsPath?: string;
  verbose?: boolean;
  cwd: string;
}

const TOOLS_BUILD_REMEDIATION =
  'Tool files must be built with the @module-federation/mcp/rslib preset; then run npx zephyr-cli deploy dist.';

/**
 * Deploy an MCP provider (contract sections 2, 3 and 8.1). Checks run first and any error
 * aborts before ZephyrEngine.create. Only the contract asset set is uploaded, read with
 * fail-on-error; the generic directory extractor is never used.
 */
export async function deployMcpProvider(options: McpDeployOptions): Promise<void> {
  const { directoryPath, classification, cwd, verbose } = options;
  rejectUnsupportedOptions(options);

  if (
    classification.kind === 'tools-repo' ||
    classification.kind === 'tools-without-package-json'
  ) {
    // Same evidence path as doctor (amendment 13.3): the preset's output for an
    // opted-in package, else the tool sources.
    const evidence =
      classification.kind === 'tools-repo' ? 'dist/mcp-provider.json' : 'tools';
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: `ZD0732 ${evidence}: ${TOOLS_BUILD_REMEDIATION}`,
    });
  }

  if (classification.kind === 'provider-artifact') {
    const artifact = await inspectProviderArtifact(directoryPath);
    reportFindings(artifact.findings);
    for (const ignored of artifact.ignoredPaths) {
      logFn('warn', `Not part of the MCP provider artifact, not uploaded: ${ignored}`);
    }
    const catalog = artifact.catalog;
    if (!catalog) throw checksFailed();

    const evalResults = await maybeLoadEvalResults(
      options,
      new Set(catalog.skills.map((skill) => skill.name))
    );
    const zephyr_engine = await ZephyrEngine.create({
      builder: 'unknown',
      context: directoryPath,
    });
    await upload(zephyr_engine, toAssetsMap(artifact.files), evalResults, verbose);
    return;
  }

  const scan = await scanSkillsRepo(directoryPath);
  reportFindings(scan.findings);
  // Validate the in-memory artifact before any network work (catalog size and every
  // other artifact rule); the provider name is filled in after the engine resolves it.
  reportFindings(checkSkillsRepoArtifact(scan));
  const evalResults = await maybeLoadEvalResults(
    options,
    new Set(scan.skills.map((skill) => skill.folder))
  );

  // Isolated identity: the provider is named from zephyr.config appName, the git project,
  // or the directory, and never from a package.json (contract section 1.1).
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'unknown',
    context: directoryPath,
    identity: { fromGitProject: true, isolated: true },
  });

  let assetsMap: ZeBuildAssetsMap;
  try {
    const artifact = buildSkillsRepoArtifact(scan, {
      name: zephyr_engine.applicationProperties.name,
      generatorVersion: getZephyrCliVersion(),
    });
    reportFindings(artifact.findings);
    assetsMap = toAssetsMap(artifact.files);
    if (verbose) {
      logFn('info', `Publishing MCP provider "${artifact.descriptor.name}" from ${cwd}`);
    }
  } catch (error) {
    if (zephyr_engine.hasActiveBuild) zephyr_engine.build_failed();
    throw error;
  }
  await upload(zephyr_engine, assetsMap, evalResults, verbose);
}

/**
 * `run` and `watch` publish web output only. Fail for any MCP-classified directory so it
 * is never uploaded as a public web app (M1), and warn when legacy output carries a
 * `skills/` folder that will be public.
 */
export async function assertNotMcpOutput(
  directory: string,
  command: 'run' | 'watch'
): Promise<void> {
  const classification = await classifyMcpDirectory(directory);
  if (classification.kind !== 'legacy') {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `${directory} is an MCP provider (${classification.kind}) and ${command} cannot publish it; use ze-cli deploy (npx zephyr-cli deploy <dir>) instead.`,
    });
  }
  if (classification.publicSkillsDirectory) warnPublicSkillsDirectory(directory);
}

/** Classifier rule 4: a legacy upload publishes `<dir>/skills/` like any other file. */
export function warnPublicSkillsDirectory(directory: string): void {
  logFn(
    'warn',
    `${directory}/skills will be published publicly as part of this web upload. To publish skills privately to your organization's Zephyr MCP, add "mcp: true" to zephyr.config or depend on @module-federation/mcp, then run npx zephyr-cli deploy.`
  );
}

function rejectUnsupportedOptions(options: McpDeployOptions): void {
  const problems: string[] = [];
  if (options.target !== undefined && options.target !== 'web') {
    problems.push(`--target ${options.target}`);
  }
  if (options.metadataPath !== undefined) problems.push('--metadata');
  if (options.ssr) problems.push('--ssr');
  if (problems.length > 0) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `MCP provider deploys do not support ${problems.join(', ')}.`,
    });
  }
}

async function maybeLoadEvalResults(
  options: McpDeployOptions,
  skills: ReadonlySet<string>
): Promise<EvalResults | undefined> {
  if (options.evalResultsPath === undefined) return undefined;
  return loadEvalResults({
    evalResultsPath: options.evalResultsPath,
    cwd: options.cwd,
    skills,
  });
}

function reportFindings(findings: readonly DoctorFinding[]): void {
  if (findings.length === 0) return;
  for (const line of formatFindingLines(findings)) console.error(`[ze-cli] ${line}`);
  if (findings.some(({ severity }) => severity === 'error')) throw checksFailed();
}

function checksFailed(): ZephyrError<'ERR_DEPLOY_LOCAL_BUILD'> {
  return new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
    message:
      'MCP provider checks failed; nothing was uploaded. Run npx zephyr-cli doctor <dir> for details.',
  });
}

function toAssetsMap(files: ReadonlyMap<string, Uint8Array>): ZeBuildAssetsMap {
  const record: Record<string, Buffer> = {};
  for (const [filePath, bytes] of files) record[filePath] = Buffer.from(bytes);
  return buildAssetsMap(
    record,
    (content) => content,
    () => 'mcp'
  );
}

async function upload(
  zephyr_engine: ZephyrEngine,
  assetsMap: ZeBuildAssetsMap,
  evalResults: EvalResults | undefined,
  verbose: boolean | undefined
): Promise<void> {
  if (verbose)
    logFn('info', `Uploading ${Object.keys(assetsMap).length} MCP provider files`);
  await uploadAssets({
    zephyr_engine,
    assetsMap,
    ...(evalResults ? { mcpEvalResults: evalResults } : {}),
  });
}
