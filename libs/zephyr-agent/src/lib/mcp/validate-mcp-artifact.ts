import {
  type CatalogManifest,
  type McpProviderDescriptor,
  ZEPHYR_MCP_CATALOG_FILENAME,
  ZEPHYR_MCP_PROVIDER_FILENAME,
  ZEPHYR_MCP_RUNTIME_ENTRY,
} from 'zephyr-edge-contract';
import {
  MCP_LIMITS,
  MCP_RESERVED_TOOL_NAMES,
  isCalendarDate,
  isDeniedMcpArtifactPath,
  isPlainObject,
  isSafeMcpRelativePath,
  isServedMcpSkillFilePath,
  isValidMcpSkillName,
  isValidMcpToolName,
  mcpMimeTypeForPath,
  sha256Hex,
} from './mcp-rules';
import { mcpRuntimeModuleProblems } from './runtime-module';
import { canonicalMcpJson, parseMcpSkillMarkdown } from './skill-frontmatter';

/**
 * Artifact-mode check codes shared with ze-cli doctor (contract section 8.2). The agent
 * reports the codes so ze-cli can render the same findings it fails a deploy with.
 */
export type McpArtifactIssueCode =
  | 'ZD0711'
  | 'ZD0712'
  | 'ZD0713'
  | 'ZD0714'
  | 'ZD0719'
  | 'ZD0730'
  | 'ZD0734'
  | 'ZD0737'
  | 'ZD0740'
  | 'ZD0741'
  | 'ZD0742'
  | 'ZD0743';

export interface McpArtifactIssue {
  code: McpArtifactIssueCode;
  /** Artifact-relative evidence path. Never file contents. */
  path: string;
  message: string;
}

export interface McpArtifactValidation {
  issues: McpArtifactIssue[];
  descriptor?: McpProviderDescriptor;
  catalog?: CatalogManifest;
  /** Sha256 of the catalog bytes exactly as they will be uploaded. */
  catalogSha256?: string;
  /** Every path the descriptor and catalog require, in upload order. */
  expectedPaths: string[];
}

export interface ValidateMcpArtifactOptions {
  /**
   * Ignore files outside the required set instead of rejecting them. ze-cli uses this to
   * warn about extra build output it will not upload; the agent never does.
   */
  ignoreExtraPaths?: boolean;
}

const DESCRIPTOR_KEYS = new Set([
  'manifestVersion',
  'name',
  'version',
  'catalog',
  'generator',
]);
const GENERATOR_KEYS = new Set(['name', 'version']);
const ANNOTATION_HINTS = [
  'readOnlyHint',
  'destructiveHint',
  'idempotentHint',
  'openWorldHint',
] as const;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Earliest `runtime.compatibilityDate` (amendment 13.1); the Zephyr MCP does not load
 * tools built for an earlier runtime.
 */
export const MCP_MIN_COMPATIBILITY_DATE = '2025-11-17';

/** Decode UTF-8 JSON without guessing; returns `undefined` for any malformed input. */
export function parseMcpJson(bytes: Uint8Array): unknown {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
      bytes
    );
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Validate `mcp-provider.json`; strict, unknown keys are rejected. */
export function parseMcpProviderDescriptor(bytes: Uint8Array | undefined): {
  descriptor?: McpProviderDescriptor;
  issues: McpArtifactIssue[];
} {
  const issues: McpArtifactIssue[] = [];
  const issue = (message: string) =>
    issues.push({ code: 'ZD0740', path: ZEPHYR_MCP_PROVIDER_FILENAME, message });

  if (!bytes) {
    issue('mcp-provider.json is missing from the artifact root.');
    return { issues };
  }
  const value = parseMcpJson(bytes);
  if (!isPlainObject(value)) {
    issue('mcp-provider.json must be a UTF-8 JSON object.');
    return { issues };
  }

  for (const key of Object.keys(value)) {
    if (!DESCRIPTOR_KEYS.has(key)) issue(`Unknown descriptor key "${key}".`);
  }
  if (value['manifestVersion'] !== 1) issue('manifestVersion must be 1.');
  if (!isValidMcpSkillName(value['name'])) {
    issue(
      'name must match ^[a-z0-9]+(-[a-z0-9]+)*$, be at most 64 characters, and not be "evals".'
    );
  }
  const version = value['version'];
  if (
    version !== undefined &&
    (typeof version !== 'string' || version.length > MCP_LIMITS.versionLength)
  ) {
    issue('version must be a string of at most 64 characters.');
  }
  if (value['catalog'] !== ZEPHYR_MCP_CATALOG_FILENAME) {
    issue(`catalog must be "${ZEPHYR_MCP_CATALOG_FILENAME}".`);
  }
  const generator = value['generator'];
  if (
    !isPlainObject(generator) ||
    Object.keys(generator).some((key) => !GENERATOR_KEYS.has(key)) ||
    !isNonEmptyString(generator['name']) ||
    !isNonEmptyString(generator['version'])
  ) {
    issue(
      'generator must be { name, version } with non-empty strings and no other keys.'
    );
  }

  return issues.length
    ? { issues }
    : { descriptor: value as unknown as McpProviderDescriptor, issues };
}

/**
 * Validate `catalog.json` (CatalogManifest v1). Listed fields are validated; unknown keys
 * are allowed and the parsed object is returned unchanged so they are preserved.
 */
export function parseCatalogManifest(
  bytes: Uint8Array | undefined,
  descriptor?: McpProviderDescriptor,
  catalogPath: string = ZEPHYR_MCP_CATALOG_FILENAME
): { catalog?: CatalogManifest; catalogSha256?: string; issues: McpArtifactIssue[] } {
  const issues: McpArtifactIssue[] = [];
  const issue = (message: string, code: McpArtifactIssueCode = 'ZD0741') =>
    issues.push({ code, path: catalogPath, message });

  if (!bytes) {
    issue(`${catalogPath} is missing from the artifact.`);
    return { issues };
  }
  if (bytes.byteLength > MCP_LIMITS.catalogBytes) {
    issue(`${catalogPath} is larger than ${MCP_LIMITS.catalogBytes} bytes.`);
    return { issues };
  }
  const value = parseMcpJson(bytes);
  if (!isPlainObject(value)) {
    issue(`${catalogPath} must be a UTF-8 JSON object.`);
    return { issues };
  }

  if (value['manifestVersion'] !== 1) issue('manifestVersion must be 1.');
  validateProvider(value['provider'], descriptor, issue);

  const skills = value['skills'];
  const tools = value['tools'];
  if (!Array.isArray(skills)) {
    issue('skills must be an array.');
  } else {
    if (skills.length > MCP_LIMITS.skills) {
      issue(`A catalog lists at most ${MCP_LIMITS.skills} skills.`);
    }
    const names = new Set<string>();
    skills.forEach((skill, index) => {
      validateSkill(skill, `skills[${index}]`, issue);
      const name = isPlainObject(skill) ? skill['name'] : undefined;
      if (typeof name === 'string') {
        if (names.has(name)) issue(`Duplicate skill name "${name}".`, 'ZD0743');
        names.add(name);
      }
    });
  }
  if (!Array.isArray(tools)) {
    issue('tools must be an array.');
  } else {
    if (tools.length > MCP_LIMITS.tools) {
      issue(`A catalog lists at most ${MCP_LIMITS.tools} tools.`);
    }
    const names = new Set<string>();
    tools.forEach((tool, index) => {
      validateTool(tool, `tools[${index}]`, issue);
      const name = isPlainObject(tool) ? tool['name'] : undefined;
      if (typeof name === 'string') {
        if (names.has(name)) issue(`Duplicate tool name "${name}".`, 'ZD0743');
        names.add(name);
      }
    });
  }

  const hasTools = Array.isArray(tools) && tools.length > 0;
  if (hasTools && value['runtime'] === undefined) {
    issue('runtime is required when the catalog lists tools.');
  } else if (!hasTools && value['runtime'] !== undefined) {
    issue('runtime must be absent when the catalog lists no tools.');
  } else if (hasTools) {
    validateRuntime(value['runtime'], issue);
  }

  return issues.length
    ? { issues }
    : {
        catalog: value as unknown as CatalogManifest,
        catalogSha256: sha256Hex(bytes),
        issues,
      };
}

/** Every artifact path a valid descriptor and catalog require, in upload order. */
export function expectedMcpArtifactPaths(
  descriptor: McpProviderDescriptor,
  catalog: CatalogManifest
): string[] {
  const paths = [ZEPHYR_MCP_PROVIDER_FILENAME, descriptor.catalog];
  for (const skill of catalog.skills) {
    for (const file of skill.files) paths.push(`${skill.path}/${file.path}`);
  }
  for (const module of catalog.runtime?.modules ?? []) paths.push(module.path);
  return paths;
}

/**
 * Validate an artifact against contract section 2: descriptor, catalog, the exact asset
 * set, the raw size and sha256 of every listed file, and a self-contained runtime module
 * (amendment 12.2). Pure; never reads the disk.
 */
export function validateMcpArtifact(
  files: ReadonlyMap<string, Uint8Array>,
  options: ValidateMcpArtifactOptions = {}
): McpArtifactValidation {
  const descriptorResult = parseMcpProviderDescriptor(
    files.get(ZEPHYR_MCP_PROVIDER_FILENAME)
  );
  const issues = [...descriptorResult.issues];
  const { descriptor } = descriptorResult;
  const catalogPath = descriptor?.catalog ?? ZEPHYR_MCP_CATALOG_FILENAME;
  const catalogResult = parseCatalogManifest(
    files.get(catalogPath),
    descriptor,
    catalogPath
  );
  issues.push(...catalogResult.issues);
  const { catalog, catalogSha256 } = catalogResult;

  if (!descriptor || !catalog) {
    for (const path of files.keys()) {
      const issue = unsafePathIssue(path);
      if (issue) issues.push(issue);
    }
    return { issues, descriptor, catalog, catalogSha256, expectedPaths: [] };
  }

  const expectedPaths = expectedMcpArtifactPaths(descriptor, catalog);
  const expected = new Set(expectedPaths);
  const sizes = new Map<string, { size: number; sha256: string }>();
  for (const skill of catalog.skills) {
    for (const file of skill.files) {
      sizes.set(`${skill.path}/${file.path}`, { size: file.size, sha256: file.sha256 });
    }
  }
  for (const module of catalog.runtime?.modules ?? []) {
    sizes.set(module.path, { size: module.size, sha256: module.sha256 });
  }

  const mismatched = new Set<string>();
  for (const [path, digest] of sizes) {
    const pathIssue = unsafePathIssue(path);
    if (pathIssue) {
      issues.push(pathIssue);
      mismatched.add(path);
      continue;
    }
    const bytes = files.get(path);
    if (
      !bytes ||
      bytes.byteLength !== digest.size ||
      sha256Hex(bytes) !== digest.sha256
    ) {
      mismatched.add(path);
    }
    if (!bytes) {
      issues.push({
        code: 'ZD0741',
        path,
        message: 'Listed in the catalog but missing.',
      });
    } else if (bytes.byteLength !== digest.size) {
      issues.push({
        code: 'ZD0741',
        path,
        message: `Size ${bytes.byteLength} does not match the catalog size ${digest.size}.`,
      });
    } else if (sha256Hex(bytes) !== digest.sha256) {
      issues.push({
        code: 'ZD0741',
        path,
        message: 'sha256 does not match the catalog.',
      });
    }
  }

  for (const path of files.keys()) {
    if (expected.has(path)) continue;
    const pathIssue = unsafePathIssue(path);
    if (pathIssue) {
      issues.push(pathIssue);
    } else if (!options.ignoreExtraPaths) {
      issues.push({
        code: 'ZD0741',
        path,
        message:
          'Not part of the provider artifact (only the descriptor, catalog, listed skill files and runtime module are uploaded).',
      });
    }
  }

  issues.push(...frontmatterIssues(catalog, files, mismatched));

  const entry = catalog.runtime?.entry;
  const runtimeModule = entry === undefined ? undefined : files.get(entry);
  if (entry !== undefined && runtimeModule) {
    issues.push(...runtimeModuleIssues(entry, runtimeModule));
  }

  return { issues, descriptor, catalog, catalogSha256, expectedPaths };
}

/**
 * Amendment 12.2: the runtime module must be one self-contained UTF-8 file. Checked
 * whatever its digest, so a stale catalog cannot hide an import.
 */
function runtimeModuleIssues(entry: string, bytes: Uint8Array): McpArtifactIssue[] {
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return [{ code: 'ZD0741', path: entry, message: 'The runtime module is not UTF-8.' }];
  }
  return mcpRuntimeModuleProblems(source).map((problem) => ({
    code: 'ZD0741',
    path: entry,
    message: `The runtime module ${problem}; it must be one self-contained file.`,
  }));
}

/** Format issues for an error message: codes and paths, never file contents. */
export function formatMcpArtifactIssues(
  issues: readonly McpArtifactIssue[],
  limit = 20
): string {
  const lines = issues
    .slice(0, limit)
    .map(({ code, path, message }) => `- ${code} ${path}: ${message}`);
  if (issues.length > limit) lines.push(`- ...and ${issues.length - limit} more`);
  return lines.join('\n');
}

/**
 * Amendment 13.4: the catalog's frontmatter drives skills/list, so each served SKILL.md
 * must parse (ZD0711) to the same frontmatter, compared as key-sorted JSON (ZD0741). A
 * SKILL.md that is missing or does not match its catalog digest is already ZD0741.
 */
function frontmatterIssues(
  catalog: CatalogManifest,
  files: ReadonlyMap<string, Uint8Array>,
  mismatched: ReadonlySet<string>
): McpArtifactIssue[] {
  const issues: McpArtifactIssue[] = [];
  for (const skill of catalog.skills) {
    const path = `${skill.path}/SKILL.md`;
    const bytes = files.get(path);
    if (!bytes || mismatched.has(path)) continue;
    const parsed = parseMcpSkillMarkdown(bytes);
    if (!parsed) {
      issues.push({
        code: 'ZD0711',
        path,
        message: 'SKILL.md frontmatter is missing, is not YAML, or is not a mapping.',
      });
    } else if (
      canonicalMcpJson(parsed.frontmatter) !== canonicalMcpJson(skill.frontmatter)
    ) {
      issues.push({
        code: 'ZD0741',
        path,
        message:
          "The SKILL.md frontmatter differs from the catalog's; rebuild the artifact.",
      });
    }
  }
  return issues;
}

/**
 * ZD0742 for the denied list (evals, source maps, dot segments, TypeScript under tools/);
 * ZD0741 for any other unsafe path, such as a backslash, an empty segment or an absolute
 * root (amendments 12.3 and 13.2).
 */
function unsafePathIssue(path: string): McpArtifactIssue | undefined {
  if (isDeniedMcpArtifactPath(path)) {
    return {
      code: 'ZD0742',
      path,
      message:
        'Path is never uploaded: evals, source maps, dot segments and TypeScript under tools/ are denied.',
    };
  }
  if (!isSafeMcpRelativePath(path)) {
    return {
      code: 'ZD0741',
      path,
      message:
        'Not a safe relative path: use "/" separators without empty segments, backslashes or an absolute root.',
    };
  }
  return undefined;
}

type IssueSink = (message: string, code?: McpArtifactIssueCode) => void;

function validateProvider(
  provider: unknown,
  descriptor: McpProviderDescriptor | undefined,
  issue: IssueSink
): void {
  if (!isPlainObject(provider) || typeof provider['name'] !== 'string') {
    issue('provider must be an object with a string name.');
    return;
  }
  if (provider['version'] !== undefined && typeof provider['version'] !== 'string') {
    issue('provider.version must be a string.');
  }
  if (descriptor && provider['name'] !== descriptor.name) {
    issue('provider.name must equal the descriptor name.');
  }
  if (descriptor && provider['version'] !== descriptor.version) {
    issue('provider.version must equal the descriptor version.');
  }
}

function validateSkill(skill: unknown, at: string, issue: IssueSink): void {
  if (!isPlainObject(skill)) {
    issue(`${at} must be an object.`);
    return;
  }
  const name = skill['name'];
  if (!isValidMcpSkillName(name)) {
    issue(`${at}.name is not a valid skill name.`, 'ZD0712');
    return;
  }
  if (skill['path'] !== `skills/${name}`) issue(`${at}.path must be "skills/${name}".`);

  const frontmatter = skill['frontmatter'];
  if (!isPlainObject(frontmatter)) {
    issue(`${at}.frontmatter must be an object.`);
  } else {
    if (frontmatter['name'] !== name) {
      issue(`${at}.frontmatter.name must equal the skill name.`, 'ZD0712');
    }
    const description = frontmatter['description'];
    if (
      typeof description !== 'string' ||
      description.length === 0 ||
      description.length > MCP_LIMITS.descriptionLength
    ) {
      issue(`${at}.frontmatter.description must be 1 to 1,024 characters.`, 'ZD0713');
    }
    for (const key of ['license', 'allowed-tools'] as const) {
      if (frontmatter[key] !== undefined && typeof frontmatter[key] !== 'string') {
        issue(`${at}.frontmatter.${key} must be a string.`, 'ZD0714');
      }
    }
    const compatibility = frontmatter['compatibility'];
    if (
      compatibility !== undefined &&
      (typeof compatibility !== 'string' ||
        compatibility.length > MCP_LIMITS.compatibilityLength)
    ) {
      issue(
        `${at}.frontmatter.compatibility must be a string of at most 500 characters.`,
        'ZD0714'
      );
    }
    const metadata = frontmatter['metadata'];
    if (
      metadata !== undefined &&
      (!isPlainObject(metadata) ||
        Object.values(metadata).some((v) => typeof v !== 'string'))
    ) {
      issue(`${at}.frontmatter.metadata values must be strings.`, 'ZD0714');
    }
  }

  const files = skill['files'];
  if (!Array.isArray(files) || files.length === 0) {
    issue(`${at}.files must be a non-empty array.`);
    return;
  }
  if (files.length > MCP_LIMITS.filesPerSkill) {
    issue(`${at} lists more than ${MCP_LIMITS.filesPerSkill} files.`, 'ZD0719');
  }
  const paths = new Set<string>();
  let totalBytes = 0;
  files.forEach((file, index) => {
    const fileAt = `${at}.files[${index}]`;
    if (!isPlainObject(file)) {
      issue(`${fileAt} must be an object.`);
      return;
    }
    const path = file['path'];
    if (typeof path !== 'string' || path.length === 0) {
      issue(`${fileAt}.path must be a non-empty string.`);
      return;
    }
    // The catalog itself must never list a path the artifact may not contain. ZD0742 is
    // only the denied list (dot segments included); any other unsafe path, such as a
    // backslash or an empty segment, is ZD0741 (amendment 13.2).
    if (isDeniedMcpArtifactPath(`skills/${name}/${path}`)) {
      issue(
        `${fileAt}.path is never served (evals, source maps and dot segments are denied).`,
        'ZD0742'
      );
      return;
    }
    if (!isSafeMcpRelativePath(path)) {
      issue(
        `${fileAt}.path must be a safe relative path ("/" separators, no empty segments, backslashes or absolute root).`
      );
      return;
    }
    // Amendment 12.3: outside the served set (or under node_modules) is ZD0741, not ZD0742.
    if (!isServedMcpSkillFilePath(path)) {
      issue(
        `${fileAt}.path must be SKILL.md or a file under references/, assets/ or scripts/, without a node_modules segment.`
      );
      return;
    }
    if (paths.has(path)) issue(`${fileAt}.path duplicates "${path}".`);
    paths.add(path);
    if (file['mimeType'] !== mcpMimeTypeForPath(path)) {
      issue(
        `${fileAt}.mimeType must be "${mcpMimeTypeForPath(path)}" (contract MIME table).`
      );
    }
    const size = file['size'];
    if (!isByteSize(size, Number.MAX_SAFE_INTEGER)) {
      issue(`${fileAt}.size must be a non-negative integer.`);
    } else {
      totalBytes += size;
      if (size > MCP_LIMITS.skillFileBytes) {
        issue(
          `${fileAt}.size is larger than ${MCP_LIMITS.skillFileBytes} bytes (5 MiB).`,
          'ZD0719'
        );
      }
    }
    if (typeof file['sha256'] !== 'string' || !SHA256_PATTERN.test(file['sha256'])) {
      issue(`${fileAt}.sha256 must be 64 lowercase hex characters.`);
    }
  });
  if (!paths.has('SKILL.md')) issue(`${at}.files must include SKILL.md.`);
  if (totalBytes > MCP_LIMITS.skillTotalBytes) {
    issue(
      `${at} files total ${totalBytes} bytes, more than ${MCP_LIMITS.skillTotalBytes} (16 MiB).`,
      'ZD0719'
    );
  }
}

function validateTool(tool: unknown, at: string, issue: IssueSink): void {
  if (!isPlainObject(tool)) {
    issue(`${at} must be an object.`);
    return;
  }
  const name = tool['name'];
  if (!isValidMcpToolName(name)) {
    issue(`${at}.name must match ^[A-Za-z0-9_-]{1,64}$.`, 'ZD0730');
  } else if (MCP_RESERVED_TOOL_NAMES.has(name)) {
    issue(`${at}.name "${name}" is reserved by the Zephyr MCP.`, 'ZD0734');
  }
  if (tool['title'] !== undefined && typeof tool['title'] !== 'string') {
    issue(`${at}.title must be a string.`);
  }
  const description = tool['description'];
  if (
    typeof description !== 'string' ||
    description.length === 0 ||
    description.length > MCP_LIMITS.toolDescriptionLength
  ) {
    issue(`${at}.description must be 1 to 2,048 characters.`);
  }
  if (!isObjectSchema(tool['inputSchema'])) {
    issue(
      `${at}.inputSchema must be a JSON Schema with root type "object", no $schema and no root $ref.`,
      'ZD0737'
    );
  }
  if (tool['outputSchema'] !== undefined && !isObjectSchema(tool['outputSchema'])) {
    issue(
      `${at}.outputSchema must be a JSON Schema with root type "object", no $schema and no root $ref.`,
      'ZD0737'
    );
  }
  const annotations = tool['annotations'];
  if (annotations !== undefined) {
    if (!isPlainObject(annotations)) {
      issue(`${at}.annotations must be an object.`);
    } else {
      if (
        annotations['title'] !== undefined &&
        typeof annotations['title'] !== 'string'
      ) {
        issue(`${at}.annotations.title must be a string.`);
      }
      for (const hint of ANNOTATION_HINTS) {
        if (annotations[hint] !== undefined && typeof annotations[hint] !== 'boolean') {
          issue(`${at}.annotations.${hint} must be a boolean.`);
        }
      }
    }
  }
}

function validateRuntime(runtime: unknown, issue: IssueSink): void {
  if (!isPlainObject(runtime)) {
    issue('runtime must be an object.');
    return;
  }
  if (runtime['protocol'] !== 1) issue('runtime.protocol must be 1.');
  if (runtime['entry'] !== ZEPHYR_MCP_RUNTIME_ENTRY) {
    issue(`runtime.entry must be "${ZEPHYR_MCP_RUNTIME_ENTRY}".`);
  }
  const modules = runtime['modules'];
  if (!Array.isArray(modules) || modules.length !== 1) {
    issue('runtime.modules must contain exactly one module.');
  } else {
    const [module] = modules;
    if (!isPlainObject(module) || module['path'] !== runtime['entry']) {
      issue('runtime.modules[0].path must equal runtime.entry.');
    } else {
      if (!isByteSize(module['size'], MCP_LIMITS.runtimeModuleBytes)) {
        issue(
          `runtime.modules[0].size must be an integer from 0 to ${MCP_LIMITS.runtimeModuleBytes}.`
        );
      }
      if (
        typeof module['sha256'] !== 'string' ||
        !SHA256_PATTERN.test(module['sha256'])
      ) {
        issue('runtime.modules[0].sha256 must be 64 lowercase hex characters.');
      }
    }
  }
  const date = runtime['compatibilityDate'];
  if (typeof date !== 'string' || !DATE_PATTERN.test(date) || !isCalendarDate(date)) {
    issue('runtime.compatibilityDate must be a YYYY-MM-DD date.');
  } else if (date < MCP_MIN_COMPATIBILITY_DATE) {
    issue(
      `runtime.compatibilityDate must be ${MCP_MIN_COMPATIBILITY_DATE} or later; the Zephyr MCP does not load earlier dates.`
    );
  }
  const flags = runtime['compatibilityFlags'];
  if (
    flags !== undefined &&
    !(Array.isArray(flags) && flags.length === 1 && flags[0] === 'enable_request_signal')
  ) {
    issue(
      'runtime.compatibilityFlags must be absent or exactly ["enable_request_signal"].'
    );
  }
}

function isObjectSchema(schema: unknown): boolean {
  return (
    isPlainObject(schema) &&
    schema['type'] === 'object' &&
    !('$schema' in schema) &&
    !('$ref' in schema)
  );
}

function isByteSize(value: unknown, maximum: number): value is number {
  return (
    Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
