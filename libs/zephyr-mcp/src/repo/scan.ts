import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { SERVED_SKILL_DIRS } from '../manifest/constants';
import { compareStrings, isExcludedSegment, isSourceMap } from '../manifest/paths';

/** A file read as raw bytes, never decoded. */
export interface RepoFile {
  /** Relative to the skill folder (skill files) or the repo (tool files). */
  path: string;
  bytes: Uint8Array;
}

/** Everything the checks need to know about one folder under `skills/`. */
export interface ScannedSkillFolder {
  /** The folder name. */
  name: string;
  /** `skills/<name>`. */
  path: string;
  /** Whether `SKILL.md` is a regular file. */
  hasSkillFile: boolean;
  /** Served files, `SKILL.md` included, sorted by path. */
  files: RepoFile[];
  /** Repo-relative paths of entries that are reported and not included. */
  unknownEntries: string[];
  /** `evals/evals.json`, when present (never served). */
  evals?: RepoFile;
}

export interface RepoScan {
  /** Absolute path of the repo. */
  root: string;
  hasSkillsDir: boolean;
  /** Folders under `skills/`, sorted by name. */
  skillFolders: ScannedSkillFolder[];
  /** Repo-relative paths of symlinks directly under `skills/`. */
  skillLinks: string[];
  /** Repo-relative tool file paths, e.g. `tools/quote_price.ts`, sorted. */
  tools: string[];
  /** Every regular file under `tools/`, for the secret scan. */
  toolSources: RepoFile[];
}

const readBytes = async (file: string) => new Uint8Array(await readFile(file));

const listDir = async (dir: string) => {
  try {
    return (await readdir(dir, { withFileTypes: true })).sort((left, right) =>
      compareStrings(left.name, right.name)
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
};

const isDirectory = (dir: string) =>
  stat(dir).then(
    (info) => info.isDirectory(),
    () => false
  );

// Walks a served folder (references/, assets/, scripts/), recursively.
const walkServed = async (
  skillDir: string,
  relative: string,
  folder: ScannedSkillFolder
): Promise<void> => {
  for (const entry of (await listDir(path.join(skillDir, relative))) ?? []) {
    const entryPath = `${relative}/${entry.name}`;
    if (isExcludedSegment(entry.name)) continue;
    if (entry.isSymbolicLink()) {
      folder.unknownEntries.push(`${folder.path}/${entryPath}`);
    } else if (entry.isDirectory()) {
      await walkServed(skillDir, entryPath, folder);
    } else if (entry.isFile() && !isSourceMap(entry.name)) {
      folder.files.push({
        path: entryPath,
        bytes: await readBytes(path.join(skillDir, entryPath)),
      });
    }
  }
};

const scanSkillFolder = async (
  skillsDir: string,
  name: string
): Promise<ScannedSkillFolder> => {
  const skillDir = path.join(skillsDir, name);
  const folder: ScannedSkillFolder = {
    name,
    path: `skills/${name}`,
    hasSkillFile: false,
    files: [],
    unknownEntries: [],
  };
  for (const entry of (await listDir(skillDir)) ?? []) {
    // Dot entries and node_modules are excluded silently, like everywhere.
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const entryPath = `${folder.path}/${entry.name}`;
    if (entry.isSymbolicLink()) {
      folder.unknownEntries.push(entryPath);
    } else if (entry.name === 'SKILL.md' && entry.isFile()) {
      folder.hasSkillFile = true;
      folder.files.push({
        path: 'SKILL.md',
        bytes: await readBytes(path.join(skillDir, entry.name)),
      });
    } else if (entry.name.toLowerCase() === 'evals' && entry.isDirectory()) {
      const evalsFile = path.join(skillDir, entry.name, 'evals.json');
      const info = await stat(evalsFile).catch(() => undefined);
      if (info?.isFile()) {
        folder.evals = {
          path: `${entry.name}/evals.json`,
          bytes: await readBytes(evalsFile),
        };
      }
    } else if (SERVED_SKILL_DIRS.includes(entry.name) && entry.isDirectory()) {
      await walkServed(skillDir, entry.name, folder);
    } else {
      folder.unknownEntries.push(entryPath);
    }
  }
  folder.files.sort((left, right) => compareStrings(left.path, right.path));
  return folder;
};

// `tools/*.ts` with glob semantics: `*` never matches a leading dot.
const isToolFile = (name: string) =>
  !name.startsWith('.') &&
  name.endsWith('.ts') &&
  !name.endsWith('.d.ts') &&
  !name.endsWith('.test.ts') &&
  !name.endsWith('.spec.ts') &&
  !name.startsWith('_');

const walkToolSources = async (
  root: string,
  relative: string,
  out: RepoFile[]
): Promise<void> => {
  for (const entry of (await listDir(path.join(root, relative))) ?? []) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const entryPath = `${relative}/${entry.name}`;
    if (entry.isDirectory()) await walkToolSources(root, entryPath, out);
    else if (entry.isFile()) {
      out.push({
        path: entryPath,
        bytes: await readBytes(path.join(root, entryPath)),
      });
    }
  }
};

/** Reads the whole repo shape once, for the loader and the checks. */
export const scanRepo = async (root: string): Promise<RepoScan> => {
  const absoluteRoot = path.resolve(root);
  const skillsDir = path.join(absoluteRoot, 'skills');
  const skillEntries = await listDir(skillsDir);
  const skillFolders: ScannedSkillFolder[] = [];
  const skillLinks: string[] = [];
  for (const entry of skillEntries ?? []) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (entry.isSymbolicLink()) skillLinks.push(`skills/${entry.name}`);
    else if (entry.isDirectory()) {
      skillFolders.push(await scanSkillFolder(skillsDir, entry.name));
    }
  }

  const toolEntries = (await listDir(path.join(absoluteRoot, 'tools'))) ?? [];
  const tools = toolEntries
    .filter((entry) => entry.isFile() && isToolFile(entry.name))
    .map((entry) => `tools/${entry.name}`);
  const toolSources: RepoFile[] = [];
  if (toolEntries.length > 0) {
    await walkToolSources(absoluteRoot, 'tools', toolSources);
  }

  return {
    root: absoluteRoot,
    hasSkillsDir: await isDirectory(skillsDir),
    skillFolders,
    skillLinks,
    tools,
    toolSources,
  };
};
