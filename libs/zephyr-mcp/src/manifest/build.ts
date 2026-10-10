import { parseSkillMarkdown } from '../frontmatter';
import { decodeUtf8, mimeTypeFor } from '../mime';
import { RuleError } from '../rules';
import type {
  CatalogFile,
  CatalogManifest,
  CatalogRuntime,
  CatalogSkill,
  CatalogTool,
} from './catalog';
import { DEFAULT_COMPATIBILITY_DATE, RUNTIME_ENTRY, RUNTIME_PROTOCOL } from './constants';
import { sha256Hex } from './hash';
import { compareStrings } from './paths';

/** A skill folder's served files, as raw bytes. */
export interface CatalogSkillInput {
  /** The folder name; becomes the catalog name and `skills/<name>`. */
  name: string;
  /** Paths relative to the skill folder, including `SKILL.md`. */
  files: ReadonlyArray<{ path: string; bytes: Uint8Array }>;
}

export interface BuildCatalogManifestInput {
  provider: { name: string; version?: string };
  skills?: readonly CatalogSkillInput[];
  /** Already converted with {@link toCatalogTool}. */
  tools?: readonly CatalogTool[];
  /** The runtime module, `tools/index.js`; required if and only if there are tools. */
  runtime?: {
    module: Uint8Array;
    /** Defaults to the package's pinned date, `2026-07-01`. */
    compatibilityDate?: string;
    compatibilityFlags?: readonly 'enable_request_signal'[];
  };
}

const describeFile = async (file: {
  path: string;
  bytes: Uint8Array;
}): Promise<CatalogFile> => ({
  path: file.path,
  mimeType: mimeTypeFor(file.path),
  size: file.bytes.byteLength,
  sha256: await sha256Hex(file.bytes),
});

const buildSkill = async (skill: CatalogSkillInput): Promise<CatalogSkill> => {
  const skillFile = skill.files.find((file) => file.path === 'SKILL.md');
  if (!skillFile) {
    throw new RuleError('skill-missing-file', `skills/${skill.name} has no SKILL.md`);
  }
  const markdown = decodeUtf8(skillFile.bytes);
  let frontmatter: Record<string, unknown>;
  try {
    if (markdown === undefined) throw new Error('SKILL.md is not UTF-8');
    frontmatter = parseSkillMarkdown(markdown).frontmatter;
  } catch (error) {
    throw new RuleError(
      'skill-frontmatter-invalid',
      `skills/${skill.name}/SKILL.md: ${(error as Error).message}`,
      { cause: error }
    );
  }
  const files = await Promise.all(
    [...skill.files]
      .sort((left, right) => compareStrings(left.path, right.path))
      .map(describeFile)
  );
  return {
    name: skill.name,
    path: `skills/${skill.name}`,
    frontmatter: frontmatter as CatalogSkill['frontmatter'],
    files,
  };
};

/**
 * Build `catalog.json` from a provider's skills (raw bytes, never decoded and
 * re-encoded), its tools and its runtime module. Skills, files and tools are sorted in
 * comparison order. It builds and does not validate: run the checks from `./checks` (or
 * `parseCatalogManifest`) on the result.
 *
 * @example
 *   ```ts
 *   const repo = await loadRepo('.');
 *   const catalog = await buildCatalogManifest({
 *     provider: { name: 'skills-basic' },
 *     skills: repo.skills,
 *   });
 *   ```;
 */
export async function buildCatalogManifest(
  input: BuildCatalogManifestInput
): Promise<CatalogManifest> {
  const tools = [...(input.tools ?? [])].sort((left, right) =>
    compareStrings(left.name, right.name)
  );
  if (tools.length > 0 && !input.runtime) {
    throw new Error(
      'A catalog with tools needs its runtime module; pass { runtime: { module } }'
    );
  }
  if (tools.length === 0 && input.runtime) {
    throw new Error('A catalog without tools has no runtime module');
  }
  const skills = await Promise.all(
    [...(input.skills ?? [])]
      .sort((left, right) => compareStrings(left.name, right.name))
      .map(buildSkill)
  );

  let runtime: CatalogRuntime | undefined;
  if (input.runtime) {
    runtime = {
      protocol: RUNTIME_PROTOCOL,
      entry: RUNTIME_ENTRY,
      modules: [
        {
          path: RUNTIME_ENTRY,
          size: input.runtime.module.byteLength,
          sha256: await sha256Hex(input.runtime.module),
        },
      ],
      compatibilityDate: input.runtime.compatibilityDate ?? DEFAULT_COMPATIBILITY_DATE,
      ...(input.runtime.compatibilityFlags && {
        compatibilityFlags: [
          ...input.runtime.compatibilityFlags,
        ] as CatalogRuntime['compatibilityFlags'],
      }),
    };
  }

  return {
    manifestVersion: 1,
    provider: {
      name: input.provider.name,
      ...(input.provider.version !== undefined && {
        version: input.provider.version,
      }),
    },
    skills,
    tools,
    ...(runtime && { runtime }),
  };
}
