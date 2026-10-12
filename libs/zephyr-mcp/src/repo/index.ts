/**
 * Read a skills-and-tools repo from disk (Node only): `skills/<name>/` folders and
 * `tools/<name>.ts` files, by the contract's inclusion rules.
 */
import { isExcludedSegment } from '../manifest/paths';
import { scanRepo, type RepoFile } from './scan';

/** A skill folder with a `SKILL.md`, and the files that are served. */
export interface RepoSkill {
  /** The folder name. */
  name: string;
  /** `skills/<name>`. */
  path: string;
  /**
   * Served files as raw bytes, sorted by path: `SKILL.md` and regular files under
   * `references/`, `assets/` and `scripts/`.
   */
  files: RepoFile[];
}

export interface Repo {
  /** Absolute path of the repo. */
  root: string;
  /** Skill folders that contain a `SKILL.md`, sorted by name. */
  skills: RepoSkill[];
  /** Tool files relative to the repo, e.g. `tools/quote_price.ts`, sorted. */
  tools: string[];
}

/**
 * Load a repo's skills and tool files. Skill files are read as raw bytes and never
 * decoded. Served: `SKILL.md` plus regular files under `references/`, `assets/` and
 * `scripts/`, minus any dot segment, `node_modules`, `evals` (any case), `*.map` and
 * symlinks. Tools: regular `tools/*.ts` files except `*.d.ts`, `*.test.ts`, `*.spec.ts`
 * and names starting with `_`. Nothing is validated here; run `checkRepo` from `./checks`
 * for that.
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
export async function loadRepo(root: string): Promise<Repo> {
  const scan = await scanRepo(root);
  return {
    root: scan.root,
    skills: scan.skillFolders
      // A folder named `evals` (any case) is never served; checkRepo
      // reports it as an invalid skill name.
      .filter((folder) => folder.hasSkillFile && !isExcludedSegment(folder.name))
      .map(({ name, path, files }) => ({ name, path, files })),
    tools: scan.tools,
  };
}

export type { RepoFile };
