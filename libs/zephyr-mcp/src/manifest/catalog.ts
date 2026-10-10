import * as z from 'zod';
import { mimeTypeFor } from '../mime';
import { isObject } from '../object';
import { RULES, type RuleCode, type RuleId } from '../rules';
import { isSkillName, RESERVED_TOOL_NAMES, TOOL_NAME_PATTERN } from '../validate';
import {
  CATALOG_MANIFEST_FILE,
  LIMITS,
  MIN_COMPATIBILITY_DATE,
  RUNTIME_COMPATIBILITY_FLAGS,
  RUNTIME_ENTRY,
} from './constants';
import { isSafeRelativePath, isServedSkillFile, listedPathDenial } from './paths';
import { frontmatterIssues } from './skill-rules';

/** `mcp-provider.json`: names the provider and points at its catalog. */
export interface McpProviderDescriptor {
  manifestVersion: 1;
  /** The provider name; follows the skill-name rule. */
  name: string;
  /** Informational, at most 64 characters. */
  version?: string;
  /** Artifact-relative path of the catalog, `catalog.json` in M1. */
  catalog: string;
  /** What wrote the artifact, e.g. `zephyr-cli` or `zephyr-mcp/rslib`. */
  generator: { name: string; version: string };
}

/** One served skill file, described by size and digest; never its bytes. */
export interface CatalogFile {
  /** Relative to the skill's `path`. */
  path: string;
  /** From the normative MIME table, never anything else. */
  mimeType: string;
  /** Raw bytes. */
  size: number;
  /** Sha256 of the raw bytes, 64 lowercase hex characters. */
  sha256: string;
  [key: string]: unknown;
}

export interface CatalogSkill {
  name: string;
  /** Always `skills/<name>`. */
  path: string;
  /** The parsed `SKILL.md` frontmatter, as written. */
  frontmatter: {
    name: string;
    description: string;
    license?: string;
    compatibility?: string;
    'allowed-tools'?: string;
    metadata?: Record<string, string>;
    [key: string]: unknown;
  };
  /** Includes `SKILL.md`; producers sort by path. */
  files: CatalogFile[];
  [key: string]: unknown;
}

/** A JSON Schema whose root is an object. */
export interface CatalogJsonSchema {
  type: 'object';
  [key: string]: unknown;
}

export interface CatalogTool {
  name: string;
  /** `tool.title`, else `annotations.title`. */
  title?: string;
  /** 1 to 2,048 characters. */
  description: string;
  /** Draft 2020-12, no `$schema`, root `$ref` inlined. */
  inputSchema: CatalogJsonSchema;
  outputSchema?: CatalogJsonSchema;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** The one ES module that runs a provider's tools in an isolate. */
export interface CatalogRuntime {
  protocol: 1;
  /** `tools/index.js`. */
  entry: string;
  /** Exactly one module, the entry. */
  modules: [{ path: string; size: number; sha256: string }];
  /** `YYYY-MM-DD`, {@link MIN_COMPATIBILITY_DATE} or later. */
  compatibilityDate: string;
  compatibilityFlags?: ['enable_request_signal'];
  [key: string]: unknown;
}

/** `catalog.json` (v1): every skill, file and tool of one provider. */
export interface CatalogManifest {
  manifestVersion: 1;
  /** Equals the descriptor's name and version. */
  provider: { name: string; version?: string; [key: string]: unknown };
  /** Producers sort by name. */
  skills: CatalogSkill[];
  /** Producers sort by name. */
  tools: CatalogTool[];
  /** Present if and only if there are tools. */
  runtime?: CatalogRuntime;
  [key: string]: unknown;
}

/** One problem found in a descriptor, catalog or eval results document. */
export interface ManifestIssue {
  /** The check rule, when the problem maps to one. */
  rule?: RuleId;
  code?: RuleCode;
  /** Where in the document, e.g. `skills/0/files/1/sha256`. Never a value. */
  path: string;
  message: string;
}

/** Thrown by the `parse*` functions; lists every problem found. */
export class ManifestError extends Error {
  readonly document: 'descriptor' | 'catalog' | 'eval-results';
  readonly issues: readonly ManifestIssue[];

  constructor(document: ManifestError['document'], issues: readonly ManifestIssue[]) {
    super(
      `Invalid ${document}:\n${issues
        .map((issue) => `- ${issue.path || '(root)'}: ${issue.message}`)
        .join('\n')}`
    );
    this.name = 'ManifestError';
    this.document = document;
    this.issues = issues;
  }
}

const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * At most `max` UTF-16 code units (`s.length`, contract 12.5). zod's `.max()` counts code
 * points, which lets astral characters through.
 */
export const maxLength = (max: number) => (value: string) => value.length <= max;

const isCalendarDate = (value: string) =>
  DATE.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

/** Strict: unknown keys are rejected. */
export const McpProviderDescriptorSchema = z.strictObject({
  manifestVersion: z.literal(1),
  name: z
    .string()
    .refine(isSkillName, 'must be 1-64 lowercase letters, digits and hyphens'),
  version: z
    .string()
    .refine(
      maxLength(LIMITS.providerVersion),
      `must be at most ${LIMITS.providerVersion} characters`
    )
    .optional(),
  // M1 pins the catalog's name, so every validator agrees on where it is.
  catalog: z
    .string()
    .refine(
      (value) => value === CATALOG_MANIFEST_FILE,
      `must be "${CATALOG_MANIFEST_FILE}"`
    ),
  generator: z.strictObject({
    name: z.string().min(1),
    version: z.string().min(1),
  }),
});

const FileShape = z.looseObject({
  path: z.string(),
  mimeType: z.string(),
  size: z.int().nonnegative(),
  sha256: z.string(),
});

const CatalogShape = z.looseObject({
  manifestVersion: z.literal(1),
  provider: z.looseObject({
    name: z.string(),
    version: z.string().optional(),
  }),
  skills: z.array(
    z.looseObject({
      name: z.string(),
      path: z.string(),
      frontmatter: z.looseObject({}),
      files: z.array(FileShape),
    })
  ),
  tools: z.array(
    z.looseObject({
      name: z.string(),
      title: z.string().optional(),
      description: z.string(),
      // Checked by the rules, so a missing or non-object schema is
      // tool-schema-invalid (ZD0737), not a shape error (contract 13.2).
      inputSchema: z.unknown().optional(),
      outputSchema: z.unknown().optional(),
      annotations: z
        .looseObject({
          title: z.string().optional(),
          readOnlyHint: z.boolean().optional(),
          destructiveHint: z.boolean().optional(),
          idempotentHint: z.boolean().optional(),
          openWorldHint: z.boolean().optional(),
        })
        .optional(),
    })
  ),
  runtime: z
    .looseObject({
      protocol: z.literal(1),
      entry: z.string(),
      modules: z.array(
        z.looseObject({
          path: z.string(),
          size: z.int().nonnegative(),
          sha256: z.string(),
        })
      ),
      compatibilityDate: z.string(),
      compatibilityFlags: z.array(z.string()).optional(),
    })
    .optional(),
});

/** A catalog rule issue with where it happened. */
export interface CatalogIssue {
  rule: RuleId;
  /** Path segments into the catalog. */
  path: Array<string | number>;
  message: string;
  /** False for deploy policies (owner, contact, tool hints). */
  fatal: boolean;
}

/**
 * Every rule a catalog breaks, beyond its JSON shape: names, paths, MIME types, digests,
 * limits, schema roots, runtime rules, clashes, and the provider/descriptor match. Never
 * rejects on ordering.
 */
export const catalogIssues = (
  catalog: CatalogManifest,
  descriptor?: Pick<McpProviderDescriptor, 'name' | 'version'>
): CatalogIssue[] => {
  const issues: CatalogIssue[] = [];
  const add = (rule: RuleId, path: CatalogIssue['path'], message: string, fatal = true) =>
    issues.push({ rule, path, message, fatal });
  const invalid = 'artifact-catalog-invalid';

  const { provider, skills, tools, runtime } = catalog;
  if (!isSkillName(provider.name)) {
    add(invalid, ['provider', 'name'], 'provider name breaks the name rule');
  }
  // With a descriptor the version only has to equal the descriptor's,
  // whose own length rule already ran (contract 13.2).
  if (
    !descriptor &&
    provider.version !== undefined &&
    provider.version.length > LIMITS.providerVersion
  ) {
    add(invalid, ['provider', 'version'], 'provider version is too long');
  }
  if (descriptor) {
    if (provider.name !== descriptor.name) {
      add(
        invalid,
        ['provider', 'name'],
        `provider name differs from the descriptor name "${descriptor.name}"`
      );
    }
    if (provider.version !== descriptor.version) {
      add(
        invalid,
        ['provider', 'version'],
        'provider version differs from the descriptor version'
      );
    }
  }

  if (skills.length > LIMITS.skills) {
    add(invalid, ['skills'], `more than ${LIMITS.skills} skills`);
  }
  const skillNames = new Set<string>();
  skills.forEach((skill, index) => {
    const at = ['skills', index];
    if (skillNames.has(skill.name)) {
      add('catalog-name-clash', [...at, 'name'], `skill "${skill.name}" is listed twice`);
    }
    skillNames.add(skill.name);
    if (!isSkillName(skill.name)) {
      add(
        'skill-name-invalid',
        [...at, 'name'],
        `skill name "${skill.name}" breaks the name rule`
      );
    }
    if (skill.path !== `skills/${skill.name}`) {
      add(invalid, [...at, 'path'], 'skill path must be skills/<name>');
    }
    for (const issue of frontmatterIssues(skill.frontmatter, skill.name)) {
      add(issue.rule, [...at, 'frontmatter'], issue.message, issue.fatal);
    }

    if (skill.files.length > LIMITS.filesPerSkill) {
      add(
        'skill-file-too-large',
        [...at, 'files'],
        `more than ${LIMITS.filesPerSkill} files`
      );
    }
    const totalBytes = skill.files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > LIMITS.skillTotalBytes) {
      add('skill-file-too-large', [...at, 'files'], 'files total more than 16 MiB');
    }
    const filePaths = new Set<string>();
    skill.files.forEach((file, fileIndex) => {
      const fileAt = [...at, 'files', fileIndex];
      if (filePaths.has(file.path)) {
        add(invalid, [...fileAt, 'path'], 'file is listed twice');
      }
      filePaths.add(file.path);
      // ZD0742 is only its list (contract 12.3); any other unsafe or
      // unserved path, `node_modules` included, is ZD0741.
      const denied = listedPathDenial(`${skill.path}/${file.path}`);
      if (denied) {
        add('artifact-path-denied', [...fileAt, 'path'], `file path ${denied}`);
        return;
      }
      if (!isSafeRelativePath(file.path)) {
        add(invalid, [...fileAt, 'path'], 'file path is not a safe relative path');
        return;
      }
      if (!isServedSkillFile(file.path)) {
        add(
          invalid,
          [...fileAt, 'path'],
          'only SKILL.md and files under references/, assets/ and scripts/ are served'
        );
      }
      if (file.mimeType !== mimeTypeFor(file.path)) {
        add(
          invalid,
          [...fileAt, 'mimeType'],
          `mimeType must be "${mimeTypeFor(file.path)}" (from the MIME table)`
        );
      }
      if (file.size > LIMITS.skillFileBytes) {
        add('skill-file-too-large', [...fileAt, 'size'], 'file is larger than 5 MiB');
      }
      if (!SHA256.test(file.sha256)) {
        add(invalid, [...fileAt, 'sha256'], 'sha256 must be 64 lowercase hex characters');
      }
    });
    if (!filePaths.has('SKILL.md')) {
      add(invalid, [...at, 'files'], 'files must include SKILL.md');
    }
  });

  if (tools.length > LIMITS.tools) {
    add(invalid, ['tools'], `more than ${LIMITS.tools} tools`);
  }
  const toolNames = new Set<string>();
  tools.forEach((tool, index) => {
    const at = ['tools', index];
    if (toolNames.has(tool.name)) {
      add('catalog-name-clash', [...at, 'name'], `tool "${tool.name}" is listed twice`);
    }
    toolNames.add(tool.name);
    if (!TOOL_NAME_PATTERN.test(tool.name)) {
      add(
        'tool-name-invalid',
        [...at, 'name'],
        'tool name must match ^[A-Za-z0-9_-]{1,64}$'
      );
    } else if (RESERVED_TOOL_NAMES.includes(tool.name)) {
      add('tool-name-reserved', [...at, 'name'], `tool name "${tool.name}" is reserved`);
    }
    if (
      tool.description.length === 0 ||
      tool.description.length > LIMITS.toolDescription
    ) {
      add(
        invalid,
        [...at, 'description'],
        `description must be 1-${LIMITS.toolDescription} characters`
      );
    }
    for (const key of ['inputSchema', 'outputSchema'] as const) {
      const schema: unknown = tool[key];
      if (schema === undefined && key === 'outputSchema') continue;
      if (!isObject(schema)) {
        add(
          'tool-schema-invalid',
          [...at, key],
          schema === undefined
            ? `${key} is missing; every tool needs a JSON Schema object`
            : `${key} must be a JSON Schema object`
        );
        continue;
      }
      if (schema['type'] !== 'object') {
        add('tool-schema-invalid', [...at, key], `${key} root must be type "object"`);
      }
      // Producers drop `$schema` and inline a root `$ref` (contract 12.4).
      for (const keyword of ['$schema', '$ref']) {
        if (Object.hasOwn(schema, keyword)) {
          add(
            'tool-schema-invalid',
            [...at, key],
            `${key} must not have a root "${keyword}"; drop $schema and inline a root $ref into $defs`
          );
        }
      }
    }
    if (
      tool.annotations?.readOnlyHint === undefined &&
      tool.annotations?.destructiveHint === undefined
    ) {
      add(
        'tool-hint-missing',
        [...at, 'annotations'],
        `tool "${tool.name}" must say whether it is read-only or destructive (annotations.readOnlyHint or destructiveHint)`,
        false
      );
    }
  });

  if (tools.length > 0 && !runtime) {
    add(invalid, ['runtime'], 'runtime is required when there are tools');
  }
  if (tools.length === 0 && runtime) {
    add(invalid, ['runtime'], 'runtime must be absent when there are no tools');
  }
  if (runtime) {
    const { entry, modules, compatibilityDate, compatibilityFlags } = runtime;
    if (entry !== RUNTIME_ENTRY) {
      add(invalid, ['runtime', 'entry'], `entry must be "${RUNTIME_ENTRY}"`);
    }
    const [module] = modules;
    if (modules.length !== 1 || !module) {
      add(invalid, ['runtime', 'modules'], 'runtime must list exactly one module');
    } else {
      if (module.path !== entry) {
        add(
          invalid,
          ['runtime', 'modules', 0, 'path'],
          'module path must equal the entry'
        );
      }
      if (module.size > LIMITS.runtimeModuleBytes) {
        add(invalid, ['runtime', 'modules', 0, 'size'], 'module is larger than 10 MiB');
      }
      if (!SHA256.test(module.sha256)) {
        add(
          invalid,
          ['runtime', 'modules', 0, 'sha256'],
          'sha256 must be 64 lowercase hex characters'
        );
      }
    }
    if (!isCalendarDate(compatibilityDate)) {
      add(invalid, ['runtime', 'compatibilityDate'], 'must be a YYYY-MM-DD date');
    } else if (compatibilityDate < MIN_COMPATIBILITY_DATE) {
      // The Zephyr MCP would skip every tool of this provider.
      add(
        invalid,
        ['runtime', 'compatibilityDate'],
        `must be ${MIN_COMPATIBILITY_DATE} or later; the Zephyr MCP does not load earlier dates`
      );
    }
    if (
      compatibilityFlags !== undefined &&
      (compatibilityFlags.length !== RUNTIME_COMPATIBILITY_FLAGS.length ||
        compatibilityFlags.some(
          (flag, flagIndex) => flag !== RUNTIME_COMPATIBILITY_FLAGS[flagIndex]
        ))
    ) {
      add(
        invalid,
        ['runtime', 'compatibilityFlags'],
        'compatibilityFlags must be absent or exactly ["enable_request_signal"]'
      );
    }
  }
  return issues;
};

/**
 * The catalog schema: its JSON shape plus every rule that makes a catalog invalid.
 * Unknown keys are kept. Deploy policies (owner and contact, tool hints) are not part of
 * it; `checkCatalog` from `./checks` reports those.
 */
export const CatalogManifestSchema = CatalogShape.superRefine((catalog, ctx) => {
  for (const issue of catalogIssues(catalog as CatalogManifest)) {
    if (!issue.fatal) continue;
    ctx.addIssue({
      code: 'custom',
      path: issue.path,
      message: `${issue.message} (${issue.rule})`,
    });
  }
});

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

const DOCUMENT_RULES: Partial<Record<ManifestError['document'], RuleId>> = {
  descriptor: 'artifact-descriptor-invalid',
  catalog: 'artifact-catalog-invalid',
};

const documentIssue = (
  document: ManifestError['document'],
  message: string
): ManifestIssue => {
  const rule = DOCUMENT_RULES[document];
  return {
    ...(rule && { rule, code: RULES[rule].code }),
    path: '',
    message,
  };
};

// The size of a parsed value is its JSON byte length, as the API measures
// an uploaded catalog. A value that has no JSON form (a BigInt, a cycle) is
// invalid, never treated as empty.
const byteLength = (input: unknown, document: ManifestError['document']): number => {
  if (typeof input === 'string') return encoder.encode(input).byteLength;
  if (input instanceof Uint8Array) return input.byteLength;
  let text: string | undefined;
  try {
    text = JSON.stringify(input);
  } catch {
    text = undefined;
  }
  if (text === undefined) {
    throw new ManifestError(document, [
      documentIssue(document, 'is not JSON-serializable'),
    ]);
  }
  return encoder.encode(text).byteLength;
};

/**
 * JSON text or bytes (strict UTF-8) parsed, or a parsed value as is; with `maxBytes`, the
 * size limit applies to the bytes or to the value's JSON. Shared by the descriptor,
 * catalog and eval-results parsers.
 */
export const toJson = (
  input: unknown,
  document: ManifestError['document'],
  maxBytes?: number
): unknown => {
  if (maxBytes !== undefined) {
    const size = byteLength(input, document);
    if (size > maxBytes) {
      throw new ManifestError(document, [
        documentIssue(document, `is ${size} bytes; the limit is ${maxBytes}`),
      ]);
    }
  }
  if (typeof input !== 'string' && !(input instanceof Uint8Array)) {
    return input;
  }
  let text: string;
  try {
    text = typeof input === 'string' ? input : decoder.decode(input);
  } catch {
    throw new ManifestError(document, [documentIssue(document, 'is not valid UTF-8')]);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ManifestError(document, [documentIssue(document, 'is not valid JSON')]);
  }
};

const zodIssues = (error: z.ZodError, rule?: RuleId): ManifestIssue[] =>
  error.issues.map((issue) => ({
    ...(rule && { rule, code: RULES[rule].code }),
    path: issue.path.map(String).join('/'),
    message: issue.message,
  }));

/**
 * Parse and validate `mcp-provider.json`, from JSON text, bytes or a parsed value.
 * Strict: unknown keys are errors.
 *
 * @example
 *   ```ts
 *   const descriptor = parseProviderDescriptor(await readFile('dist/mcp-provider.json'));
 *   ```;
 */
export function parseProviderDescriptor(input: unknown): McpProviderDescriptor {
  const result = McpProviderDescriptorSchema.safeParse(toJson(input, 'descriptor'));
  if (!result.success) {
    throw new ManifestError(
      'descriptor',
      zodIssues(result.error, 'artifact-descriptor-invalid')
    );
  }
  return result.data;
}

/**
 * Parse and validate `catalog.json`, from JSON text, bytes or a parsed value. Unknown
 * keys are kept. Pass the descriptor to also require that the provider name and version
 * match it.
 *
 * @example
 *   ```ts
 *   const catalog = parseCatalogManifest(await readFile('dist/catalog.json'), {
 *     descriptor,
 *   });
 *   ```;
 */
export function parseCatalogManifest(
  input: unknown,
  options: {
    descriptor?: Pick<McpProviderDescriptor, 'name' | 'version'>;
  } = {}
): CatalogManifest {
  const result = CatalogShape.safeParse(toJson(input, 'catalog', LIMITS.catalogBytes));
  if (!result.success) {
    throw new ManifestError(
      'catalog',
      zodIssues(result.error, 'artifact-catalog-invalid')
    );
  }
  const catalog = result.data as CatalogManifest;
  const fatal = catalogIssues(catalog, options.descriptor).filter((issue) => issue.fatal);
  if (fatal.length > 0) {
    throw new ManifestError(
      'catalog',
      fatal.map((issue) => ({
        rule: issue.rule,
        code: RULES[issue.rule].code,
        path: issue.path.join('/'),
        message: issue.message,
      }))
    );
  }
  return catalog;
}

/** Shape-only parse for checks, which report rule issues themselves. */
export const parseCatalogShape = (
  input: unknown
): { catalog: CatalogManifest } | { issues: ManifestIssue[] } => {
  let json: unknown;
  try {
    json = toJson(input, 'catalog', LIMITS.catalogBytes);
  } catch (error) {
    return {
      issues: (error as ManifestError).issues.map((issue) => ({
        ...issue,
        rule: 'artifact-catalog-invalid',
        code: RULES['artifact-catalog-invalid'].code,
      })),
    };
  }
  const result = CatalogShape.safeParse(json);
  return result.success
    ? { catalog: result.data as CatalogManifest }
    : { issues: zodIssues(result.error, 'artifact-catalog-invalid') };
};
