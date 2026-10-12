import {
  McpProviderDescriptorSchema,
  parseCatalogShape,
  type McpProviderDescriptor,
} from '../manifest/catalog';
import { CATALOG_MANIFEST_FILE, PROVIDER_DESCRIPTOR_FILE } from '../manifest/constants';
import { sha256Hex } from '../manifest/hash';
import { compareStrings, isSafeRelativePath, listedPathDenial } from '../manifest/paths';
import { decodeUtf8 } from '../mime';
import { catalogFindings } from './catalog';
import { finding, sortFindings, type Finding } from './finding';
import { findSecrets, textForSecretScan } from './secrets';
import { checkSkillFiles, parseFrontmatter } from './skill';

// Whitespace and comments between tokens: `/**/import` hides nothing.
const GAP = String.raw`(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*`;
// A quote character; `\x60` is the backtick.
const QUOTE = String.raw`["'\x60]`;
// The `import` or `export` keyword as a token: not part of a name, a
// property (`x.import`) or a string (`"import"`). Keywords cannot be
// written with escapes.
const keyword = (word: string) => String.raw`(?<![\w$.'"\x60])${word}(?![\w$])`;
const STATIC_IMPORT = new RegExp(
  String.raw`${keyword('import')}${GAP}(?:${QUOTE}|[\w$*{][^;'"\x60]*?\bfrom${GAP}${QUOTE})`
);
const EXPORT_FROM = new RegExp(
  String.raw`${keyword('export')}${GAP}(?:\*(?:${GAP}as${GAP}[\w$]+)?|\{[^}]*\})${GAP}from${GAP}${QUOTE}`
);
const DYNAMIC_IMPORT = new RegExp(String.raw`${keyword('import')}${GAP}\(`);
const PLATFORM_MODULE = /["'`](?:node|cloudflare):/;

/**
 * Why a runtime module is not self-contained: a static `import`, an `export ... from`, an
 * `import()`, or a `node:*` / `cloudflare:*` reference. Empty when it is.
 *
 * This reads the source text, so it is a guard against honest mistakes, not a sandbox:
 * the host's isolate (one module, no bindings, an egress gateway) is the boundary. Any
 * import form is reported whatever its specifier, so an escaped `"\x63loudflare:sockets"`
 * is caught as an import.
 */
export function runtimeModuleProblems(source: string): string[] {
  const problems: string[] = [];
  if (STATIC_IMPORT.test(source)) problems.push('has a static import');
  if (EXPORT_FROM.test(source)) problems.push('re-exports from another module');
  if (DYNAMIC_IMPORT.test(source)) problems.push('has a dynamic import()');
  if (PLATFORM_MODULE.test(source)) {
    problems.push('references a node:* or cloudflare:* module');
  }
  return problems;
}

// JSON with object keys sorted, so key order never counts as a difference.
const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'object' && item !== null && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([left], [right]) => compareStrings(left, right))
        )
      : item
  );

export interface CheckArtifactOptions {
  /**
   * What to do with files the descriptor and catalog do not list. ze-cli uploads only the
   * listed set, so it may `ignore` them; the agent rejects them (`error`, the default).
   */
  extraFiles?: 'error' | 'ignore';
}

/**
 * A-mode checks on a whole provider artifact, given every file in it by artifact-relative
 * path: the descriptor, the catalog (see `checkCatalog`), the exact file set with sizes
 * and sha256, denied paths, the runtime module rules, and skill content (links, length,
 * secrets). Never throws.
 *
 * @example
 *   ```ts
 *   const findings = await checkArtifact(await readArtifact('dist'));
 *   ```;
 */
export async function checkArtifact(
  files: ReadonlyMap<string, Uint8Array> | Readonly<Record<string, Uint8Array>>,
  options: CheckArtifactOptions = {}
): Promise<Finding[]> {
  const byPath: ReadonlyMap<string, Uint8Array> =
    files instanceof Map
      ? (files as ReadonlyMap<string, Uint8Array>)
      : new Map(Object.entries(files as Record<string, Uint8Array>));
  const findings: Finding[] = [];

  const descriptorBytes = byPath.get(PROVIDER_DESCRIPTOR_FILE);
  let descriptor: McpProviderDescriptor | undefined;
  if (!descriptorBytes) {
    findings.push(
      finding(
        'artifact-descriptor-invalid',
        PROVIDER_DESCRIPTOR_FILE,
        'the artifact has no mcp-provider.json at its root'
      )
    );
  } else {
    let json: unknown;
    try {
      json = JSON.parse(decodeUtf8(descriptorBytes) ?? '');
    } catch {
      findings.push(
        finding(
          'artifact-descriptor-invalid',
          PROVIDER_DESCRIPTOR_FILE,
          'mcp-provider.json is not valid JSON'
        )
      );
    }
    if (json !== undefined) {
      const result = McpProviderDescriptorSchema.safeParse(json);
      if (result.success) descriptor = result.data;
      else {
        for (const issue of result.error.issues) {
          findings.push(
            finding(
              'artifact-descriptor-invalid',
              PROVIDER_DESCRIPTOR_FILE,
              `${issue.path.map(String).join('/') || '(root)'}: ${issue.message}`
            )
          );
        }
      }
    }
  }

  const catalogPath = descriptor?.catalog ?? CATALOG_MANIFEST_FILE;
  const catalogBytes = byPath.get(catalogPath);
  if (!catalogBytes) {
    findings.push(
      finding(
        'artifact-catalog-invalid',
        catalogPath,
        'the catalog file named by mcp-provider.json is missing'
      )
    );
    return sortFindings(findings);
  }
  // A missing or invalid descriptor is ZD0740 alone (contract 13.2).
  findings.push(
    ...catalogFindings(catalogBytes, {
      descriptor,
      descriptorInvalid: descriptor === undefined,
      catalogPath,
    })
  );
  const shape = parseCatalogShape(catalogBytes);
  if ('issues' in shape) return sortFindings(findings);
  const { catalog } = shape;

  const listed = new Map<string, { size: number; sha256: string }>();
  for (const skill of catalog.skills) {
    for (const file of skill.files) {
      listed.set(`${skill.path}/${file.path}`, file);
    }
  }
  for (const module of catalog.runtime?.modules ?? []) {
    listed.set(module.path, module);
  }
  const expected = new Set([PROVIDER_DESCRIPTOR_FILE, catalogPath, ...listed.keys()]);

  for (const filePath of byPath.keys()) {
    const isListed = expected.has(filePath);
    if (!isListed && options.extraFiles === 'ignore') continue;
    // ZD0742 is only its list; other unsafe paths are ZD0741 (contract 12.3).
    const denied = listedPathDenial(filePath);
    if (denied) {
      findings.push(finding('artifact-path-denied', filePath, `the path ${denied}`));
    } else if (!isSafeRelativePath(filePath)) {
      findings.push(
        finding(
          'artifact-catalog-invalid',
          filePath,
          'the path is not a safe relative path; remove it from the artifact'
        )
      );
    } else if (!isListed) {
      findings.push(
        finding(
          'artifact-catalog-invalid',
          filePath,
          'the file is not listed in the catalog; remove it from the artifact'
        )
      );
    }
  }
  for (const [filePath, entry] of listed) {
    const bytes = byPath.get(filePath);
    if (!bytes) {
      findings.push(
        finding(
          'artifact-catalog-invalid',
          filePath,
          'the catalog lists this file but the artifact does not have it'
        )
      );
    } else if (
      bytes.byteLength !== entry.size ||
      (await sha256Hex(bytes)) !== entry.sha256
    ) {
      findings.push(
        finding(
          'artifact-catalog-invalid',
          filePath,
          'size or sha256 differs from the catalog; rebuild the artifact'
        )
      );
    }
  }

  for (const skill of catalog.skills) {
    const skillFiles = skill.files.flatMap((file) => {
      const bytes = byPath.get(`${skill.path}/${file.path}`);
      return bytes ? [{ path: file.path, bytes }] : [];
    });
    findings.push(
      ...checkSkillFiles(
        { name: skill.name, path: skill.path, files: skillFiles },
        {
          // The field rules ran on the catalog's frontmatter above; the file
          // itself must still have a parseable frontmatter block (ZD0711).
          frontmatter: 'parse',
          served: new Set(skill.files.map((file) => file.path)),
        }
      )
    );
    // The catalog's frontmatter drives skills/list; the served SKILL.md must
    // say the same thing.
    const skillFile = byPath.get(`${skill.path}/SKILL.md`);
    const parsed = skillFile && parseFrontmatter(decodeUtf8(skillFile));
    if (
      parsed &&
      !('error' in parsed) &&
      canonicalJson(parsed.frontmatter) !== canonicalJson(skill.frontmatter)
    ) {
      findings.push(
        finding(
          'artifact-catalog-invalid',
          `${skill.path}/SKILL.md`,
          "the SKILL.md frontmatter differs from the catalog's; rebuild the artifact",
          { skill: skill.name }
        )
      );
    }
  }

  const runtime = catalog.runtime;
  const moduleBytes = runtime && byPath.get(runtime.entry);
  if (runtime && moduleBytes) {
    const source = decodeUtf8(moduleBytes);
    if (source === undefined) {
      findings.push(
        finding(
          'artifact-catalog-invalid',
          runtime.entry,
          'the runtime module is not UTF-8'
        )
      );
    } else {
      for (const problem of runtimeModuleProblems(source)) {
        findings.push(
          finding(
            'artifact-catalog-invalid',
            runtime.entry,
            `the runtime module ${problem}; it must be one self-contained file`
          )
        );
      }
    }
    // Scanned even when it is not UTF-8, as latin1.
    for (const { line, masked } of findSecrets(textForSecretScan(moduleBytes))) {
      findings.push(
        finding(
          'tool-secret',
          runtime.entry,
          `line ${line} looks like a secret (${masked}); remove it and rotate it`
        )
      );
    }
  }
  return sortFindings(findings);
}
