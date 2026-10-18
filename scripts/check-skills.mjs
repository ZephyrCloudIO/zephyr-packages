import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';

// Published packages that are not build integrations. Every other published
// package must have its own skill (metadata.library) or a row in the zephyr-core
// integration table linking to its guide.
const packagesWithoutDedicatedSkill = [
  'with-zephyr',
  'zephyr-agent',
  'zephyr-edge-contract',
  'zephyr-native-cache',
  'zephyr-tap-runtime',
  'zephyr-xpack-internal',
];
// Top-level frontmatter fields defined by the Agent Skills specification.
const allowedFields = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);
const pluginManifests = [
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.cursor-plugin/plugin.json',
];

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const skillsRoot = path.join(workspaceRoot, 'skills');
const readJson = (file) => JSON.parse(readFileSync(path.join(workspaceRoot, file), 'utf8'));
const errors = [];

const publishedPackages = new Map(
  readdirSync(path.join(workspaceRoot, 'libs'))
    .map((directory) => path.join('libs', directory, 'package.json'))
    .filter((file) => existsSync(path.join(workspaceRoot, file)))
    .map(readJson)
    .filter((manifest) => !manifest.private)
    .map((manifest) => [manifest.name, manifest.version])
);
const releaseFiles = new Set(
  readJson('release-please-config.json').packages['.']['extra-files'].map((file) =>
    typeof file === 'string' ? file : file.path
  )
);
const rootVersion = readJson('package.json').version;
for (const file of releaseFiles) {
  if (!existsSync(path.join(workspaceRoot, file)))
    errors.push(`release-please-config.json: extra-file ${file} does not exist`);
}

function frontmatter(source) {
  const match = source.replace(/\r\n/gu, '\n').match(/^---\n([\s\S]*?)\n---\n/u);
  if (!match) return undefined;
  const fields = new Map();
  let parent;
  for (const line of match[1].split('\n')) {
    const topLevel = line.match(/^([\w-]+):\s*(.*)$/u);
    if (topLevel) {
      parent = topLevel[1];
      fields.set(parent, topLevel[2]);
      continue;
    }
    const nested = line.match(/^ {2}([\w-]+):\s*(.*)$/u);
    if (nested && parent === 'metadata') fields.set(`metadata.${nested[1]}`, nested[2]);
    else if (parent && line.trim()) fields.set(parent, `${fields.get(parent)} ${line.trim()}`);
  }
  return fields;
}

const coveredPackages = new Set();
for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const skillRoot = path.join(skillsRoot, entry.name);
  const skillFile = path.join(skillRoot, 'SKILL.md');
  const relativeSkillFile = path.relative(workspaceRoot, skillFile).split(path.sep).join('/');
  if (!existsSync(skillFile)) {
    errors.push(`${relativeSkillFile}: missing`);
    continue;
  }
  const source = readFileSync(skillFile, 'utf8');
  const fields = frontmatter(source);
  if (!fields) {
    errors.push(`${relativeSkillFile}: missing frontmatter`);
    continue;
  }
  if (fields.get('name') !== entry.name)
    errors.push(`${relativeSkillFile}: name must match its directory`);
  if (!fields.get('description')?.trim()) errors.push(`${relativeSkillFile}: missing description`);
  for (const field of fields.keys()) {
    if (!field.startsWith('metadata.') && !allowedFields.has(field))
      errors.push(`${relativeSkillFile}: unsupported frontmatter field ${field}`);
  }

  const library = fields.get('metadata.library');
  if (library) {
    coveredPackages.add(library);
    const version = publishedPackages.get(library);
    if (!version) errors.push(`${relativeSkillFile}: ${library} is not a published package`);
    else if (fields.get('metadata.library_version') !== `'${version}' # x-release-please-version`)
      errors.push(
        `${relativeSkillFile}: library_version must be '${version}' with the release-please marker`
      );
    if (!releaseFiles.has(relativeSkillFile))
      errors.push(`${relativeSkillFile}: not in release-please extra-files`);
  }

  for (const file of readdirSync(skillRoot, { recursive: true, withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith('.md')) continue;
    const markdown = path.join(file.parentPath, file.name);
    for (const link of readFileSync(markdown, 'utf8').matchAll(
      /\[[^\]]+\]\(([^)#\s]+)(?:#[^)]*)?\)/gu
    )) {
      const destination = link[1];
      if (/^[a-z][a-z\d+.-]*:/iu.test(destination)) continue;
      const target = path.resolve(path.dirname(markdown), destination);
      const relativeMarkdown = path.relative(workspaceRoot, markdown);
      if (!existsSync(target)) errors.push(`${relativeMarkdown}: broken link ${destination}`);
      else if (path.relative(realpathSync(skillRoot), realpathSync(target)).startsWith('..'))
        errors.push(`${relativeMarkdown}: link leaves the skill directory ${destination}`);
    }
  }
}

// Integration table rows look like: | Stack | `package` | [guide](references/integrations/x.md) |
const integrationRow =
  /^\|[^|\n]*\|\s*`([^`]+)`\s*\|\s*\[[^\]]+\]\(references\/integrations\/[^)]+\.md\)/gmu;
for (const [, name] of readFileSync(path.join(skillsRoot, 'zephyr-core/SKILL.md'), 'utf8').matchAll(
  integrationRow
)) {
  if (!publishedPackages.has(name))
    errors.push(`skills/zephyr-core/SKILL.md: ${name} is not a published package`);
  coveredPackages.add(name);
}

for (const name of publishedPackages.keys()) {
  if (!packagesWithoutDedicatedSkill.includes(name) && !coveredPackages.has(name))
    errors.push(`${name} has no skill and no guide in the zephyr-core integration table`);
}

for (const file of pluginManifests) {
  const manifest = readJson(file);
  if (manifest.version !== rootVersion) errors.push(`${file}: version must be ${rootVersion}`);
  if (!releaseFiles.has(file)) errors.push(`${file}: not in release-please extra-files`);
  if (manifest.skills !== undefined && manifest.skills !== './skills/')
    errors.push(`${file}: skills must point at ./skills/`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Skills are valid.');
}
