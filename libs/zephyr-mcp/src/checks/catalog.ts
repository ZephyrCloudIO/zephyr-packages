import {
  catalogIssues,
  McpProviderDescriptorSchema,
  parseCatalogShape,
  type CatalogManifest,
  type McpProviderDescriptor,
} from '../manifest/catalog';
import { CATALOG_MANIFEST_FILE, PROVIDER_DESCRIPTOR_FILE } from '../manifest/constants';
import { finding, sortFindings, type Finding } from './finding';

export interface CheckCatalogOptions {
  /** Evidence path of the catalog. Defaults to `catalog.json`. */
  catalogPath?: string;
}

/**
 * A-mode checks on a catalog, and on its descriptor when given: the shape, every catalog
 * rule (names, paths, MIME types, digests, limits, schema roots, runtime rules, clashes),
 * the provider/descriptor match, and the deploy policies (owner and contact, tool hints).
 * Works on parsed JSON or JSON text and never throws.
 *
 * @example
 *   ```ts
 *   const findings = checkCatalog(catalogJson, descriptorJson);
 *   if (findings.some((finding) => finding.severity === 'error')) process.exit(1);
 *   ```;
 */
export function checkCatalog(
  catalog: unknown,
  descriptor?: unknown,
  options: CheckCatalogOptions = {}
): Finding[] {
  const findings: Finding[] = [];
  let parsedDescriptor: McpProviderDescriptor | undefined;
  let descriptorInvalid = false;
  if (descriptor !== undefined) {
    const result = McpProviderDescriptorSchema.safeParse(
      typeof descriptor === 'string' ? safeJson(descriptor) : descriptor
    );
    if (result.success) parsedDescriptor = result.data;
    else {
      descriptorInvalid = true;
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

  findings.push(
    ...catalogFindings(catalog, {
      descriptor: parsedDescriptor,
      descriptorInvalid,
      catalogPath: options.catalogPath ?? CATALOG_MANIFEST_FILE,
    })
  );
  return sortFindings(findings);
}

/**
 * The catalog half of `checkCatalog`, for a descriptor that was already checked. With an
 * invalid descriptor only ZD0740 speaks for the provider: the catalog's provider fields
 * are not checked (contract 13.2).
 */
export const catalogFindings = (
  catalog: unknown,
  {
    descriptor,
    descriptorInvalid,
    catalogPath,
  }: {
    descriptor: McpProviderDescriptor | undefined;
    descriptorInvalid: boolean;
    catalogPath: string;
  }
): Finding[] => {
  const findings: Finding[] = [];
  const shape = parseCatalogShape(catalog);
  if ('issues' in shape) {
    for (const issue of shape.issues) {
      findings.push(
        finding(
          'artifact-catalog-invalid',
          catalogPath,
          `${issue.path || '(root)'}: ${issue.message}`
        )
      );
    }
    return findings;
  }

  for (const issue of catalogIssues(shape.catalog, descriptor)) {
    if (descriptorInvalid && issue.path[0] === 'provider') continue;
    findings.push(
      finding(
        issue.rule,
        catalogPath,
        `${issue.path.join('/')}: ${issue.message}`,
        subjectOf(shape.catalog, issue.path)
      )
    );
  }
  return findings;
};

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const subjectOf = (
  catalog: CatalogManifest,
  path: Array<string | number>
): { skill?: string; tool?: string } => {
  const [list, index] = path;
  if (typeof index !== 'number') return {};
  if (list === 'skills') return { skill: catalog.skills[index]?.name };
  if (list === 'tools') return { tool: catalog.tools[index]?.name };
  return {};
};
