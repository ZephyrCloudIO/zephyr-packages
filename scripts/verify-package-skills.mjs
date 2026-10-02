import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  packagesWithoutDedicatedSkill,
  publishedPackages,
  sharedSkills,
  workspaceRoot,
} from './sync-package-skills.mjs';

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}

function filesUnder(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)))
    .sort();
}

function markdownFiles(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'zephyr-package-skills-'));
try {
  for (const directory of publishedPackages()) {
    const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if (!manifest.scripts?.prepack?.includes('sync-package-skills.mjs')) {
      throw new Error(`${manifest.name} does not generate shared skills during pack`);
    }
    const consumerRoot = path.join(temporaryRoot, manifest.name);
    const modules = path.join(consumerRoot, 'node_modules');
    mkdirSync(modules, { recursive: true });
    const archive = path.join(consumerRoot, 'package.tgz');
    const pnpmCli = process.env['npm_execpath'];
    // pnpm may be a JavaScript entry point or a standalone executable (@pnpm/exe).
    if (pnpmCli && /\.[cm]?js$/u.test(pnpmCli))
      run(process.execPath, [pnpmCli, 'pack', '--out', archive], directory);
    else if (pnpmCli) run(pnpmCli, ['pack', '--out', archive], directory);
    else run('pnpm', ['pack', '--out', archive], directory);
    run('tar', ['-xzf', archive, '-C', modules], consumerRoot);
    const packageRoot = path.join(modules, manifest.name);
    mkdirSync(path.dirname(packageRoot), { recursive: true });
    renameSync(path.join(modules, 'package'), packageRoot);
    writeFileSync(
      path.join(consumerRoot, 'package.json'),
      JSON.stringify({
        name: 'skill-consumer',
        private: true,
        dependencies: { [manifest.name]: manifest.version },
        intent: { skills: [manifest.name] },
      })
    );
    const intentCli = path.join(workspaceRoot, 'node_modules/@tanstack/intent/dist/cli.mjs');
    const discovery = JSON.parse(
      run(process.execPath, [intentCli, 'list', '--json'], consumerRoot)
    );
    const skillRoot = path.join(packageRoot, 'skills');
    const dedicatedSkills = readdirSync(skillRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !sharedSkills.includes(entry.name))
      .map((entry) => entry.name);
    if (!dedicatedSkills.length && !packagesWithoutDedicatedSkill.includes(manifest.name)) {
      throw new Error(`${manifest.name} does not ship a dedicated skill for its own setup`);
    }
    for (const skill of [...sharedSkills, ...dedicatedSkills]) {
      if (sharedSkills.includes(skill)) {
        const actualRoot = path.join(skillRoot, skill);
        const expectedRoot = path.join(workspaceRoot, 'skills', skill);
        const actualFiles = filesUnder(actualRoot);
        const expectedFiles = filesUnder(expectedRoot);
        if (
          actualFiles.join('\n') !== expectedFiles.join('\n') ||
          expectedFiles.some(
            (file) =>
              !readFileSync(path.join(actualRoot, file)).equals(
                readFileSync(path.join(expectedRoot, file))
              )
          )
        ) {
          throw new Error(`${manifest.name} ships stale ${skill} guidance`);
        }
      }
      if (
        !discovery.skills.some(
          (entry) =>
            entry.use === `${manifest.name}#${skill}` && entry.packageVersion === manifest.version
        )
      ) {
        throw new Error(
          `${manifest.name} does not expose ${skill} through installed-package discovery`
        );
      }
      const loadedPath = run(
        process.execPath,
        [intentCli, 'load', `${manifest.name}#${skill}`, '--path'],
        consumerRoot
      ).trim();
      if (path.resolve(consumerRoot, loadedPath) !== path.join(skillRoot, skill, 'SKILL.md')) {
        throw new Error(`${manifest.name} loads ${skill} from outside the packed dependency`);
      }
    }
    for (const file of markdownFiles(skillRoot)) {
      for (const link of readFileSync(file, 'utf8').matchAll(
        /\[[^\]]+\]\(([^)#]+)(?:#[^)]*)?\)/gu
      )) {
        const destination = link[1];
        if (/^https?:\/\//u.test(destination)) continue;
        const target = realpathSync(path.resolve(path.dirname(file), destination));
        if (path.relative(realpathSync(packageRoot), target).startsWith('..')) {
          throw new Error(
            `${manifest.name} has a reference outside the packed package: ${destination}`
          );
        }
        readFileSync(target, 'utf8');
      }
    }
    const contents = run('tar', ['-tzf', archive], consumerRoot);
    if (contents.includes('/_artifacts/') || contents.includes('/.zephyr-generated')) {
      throw new Error(`${manifest.name} ships maintainer-only generated metadata`);
    }
    console.log(
      `Verified ${[...sharedSkills, ...dedicatedSkills].join(', ')} in ${manifest.name}@${manifest.version}`
    );
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
