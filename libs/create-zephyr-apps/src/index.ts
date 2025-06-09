#!/usr/bin/env node

import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  select,
  spinner,
  text,
} from '@clack/prompts';
import { getCatalogsFromWorkspaceManifest } from '@pnpm/catalogs.config';
import { resolveFromCatalog } from '@pnpm/catalogs.resolver';
import { findWorkspacePackagesNoCheck } from '@pnpm/workspace.find-packages';
import { readWorkspaceManifest } from '@pnpm/workspace.read-manifest';
import c from 'chalk-template';
import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { promisify } from 'node:util';
import terminalLink from 'terminal-link';
import { DependencyFields, ProjectTypes, Templates } from './templates.js';

const execAsync = promisify(exec);

// Immediate is required to avoid terminal image flickering
console.clear();
await setImmediate();

if (!process.stdout.isTTY) {
  cancel('Please run this command in a TTY terminal.');
  process.exit(1);
}

intro(c`Bootstrap your project using {cyan Zephyr}!`);
note(
  c`The only sane way to do micro-frontends\n{cyan https://docs.zephyr-cloud.io/}`,
  'Zephyr Cloud'
);

let output = await text({
  message: 'Where should we create your project?',
  placeholder: './my-app',
  validate(value) {
    if (!value.trim().length) {
      return 'Please enter a project name.';
    }
    return undefined;
  },
});

if (isCancel(output)) {
  cancel('Operation cancelled.');
  process.exit(0);
}

output = path.resolve(output);
const relativeOutput = path.relative(process.cwd(), output) || './';

// ensures output is not a directory with contents
if (fs.existsSync(output)) {
  const stats = fs.statSync(output);

  if (!stats.isDirectory()) {
    cancel(c`{cyan ${relativeOutput}} is not a directory.`);
    process.exit(1);
  }

  const files = fs.readdirSync(output);

  if (files.length > 0) {
    cancel(c`Output directory {cyan ${relativeOutput}} must be empty.`);
    process.exit(1);
  }
}

const projectKind = await select({
  message: 'What type of project you are creating?',
  initialValue: ProjectTypes[0]?.value,
  options: ProjectTypes,
  maxItems: 1,
});

if (isCancel(projectKind)) {
  cancel('Operation cancelled.');
  process.exit(0);
}

let examplesRepoName: string;
let subfolder: string;

if (projectKind === 'web') {
  const template = await select({
    message: 'Pick a template: ',
    initialValue: 'react-rspack-mf',
    options: Templates.map((temp) => ({
      value: temp.name,
      label: temp.label,
      hint: temp.hint,
    })),
  });

  if (isCancel(template)) {
    cancel('Operation cancelled.');
    process.exit(0);
  }

  examplesRepoName = 'zephyr-examples';
  subfolder = `examples/${template}`;
} else {
  examplesRepoName = 'zephyr-repack-example';
  subfolder = '';
}

const loading = spinner();
const tmpDir = path.resolve(homedir(), '.zephyr', examplesRepoName);

loading.start('Preparing temporary directory...');

if (!fs.existsSync(tmpDir)) {
  // ensures the temporary directory exists
  await fs.promises.mkdir(tmpDir, { recursive: true });
} else {
  // cleans the temporary directory
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
}

loading.message('Cloning example to temporary directory...');

try {
  const { stderr } = await execAsync(
    `git clone --quiet --depth 1 https://github.com/ZephyrCloudIO/${examplesRepoName}.git -b main ${tmpDir}`,
    { encoding: 'utf8', timeout: 1000 * 60 * 5 }
  );

  if (stderr) {
    loading.stop('Error cloning repository to temporary directory... ');
    cancel(stderr);
    process.exit(1);
  }

  const pathToCopy = path.join(tmpDir, subfolder);

  loading.message('Replacing catalogs...');

  // Monorepos uses pnpm catalogs
  const [manifest, packages] = await Promise.all([
    readWorkspaceManifest(tmpDir),
    findWorkspacePackagesNoCheck(tmpDir),
  ]);

  if (manifest) {
    const catalogs = getCatalogsFromWorkspaceManifest(manifest);

    for (const pkg of packages) {
      // Skip packages that are not in the output directory
      if (!pkg.rootDirRealPath.startsWith(pathToCopy)) {
        continue;
      }

      for (const field of DependencyFields) {
        if (!pkg.manifest[field]) {
          continue;
        }

        for (const [alias, pref] of Object.entries<string>(pkg.manifest[field])) {
          const result = resolveFromCatalog(catalogs, { alias, pref });

          switch (result.type) {
            case 'found':
              pkg.manifest[field][alias] = result.resolution.specifier;
              break;
            case 'misconfiguration':
              throw result.error;
          }
        }

        // update the catalog contents
        await pkg.writeProjectManifest(pkg.manifest, true);
      }
    }
  }

  const dotGitPath = path.join(pathToCopy, '.git');

  loading.message(`Extracting template to ${relativeOutput}...`);

  await fs.promises.cp(pathToCopy, output, {
    recursive: true,
    force: true,
    dereference: true,

    // skip .git folder
    filter(source) {
      return !source.startsWith(dotGitPath);
    },
  });

  loading.message('Cleaning up temporary directory...');

  // no need to wait this operation, as it is not critical for the user experience
  void fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(console.error);

  loading.stop(c`Project successfully created at {cyan ${relativeOutput}}!`);
} catch (error) {
  cancel(c`Error cloning repository to {cyan ${relativeOutput}}: ${error}`);
  loading.stop('Error!', 1);
  process.exit(1);
}

const shouldInitGit = await confirm({
  message: 'Would you like to initialize a new Git repository?',
  initialValue: true,
});

if (isCancel(shouldInitGit)) {
  cancel('Operation cancelled');
  process.exit(0);
}

if (shouldInitGit) {
  // Initialize the repository.
  await execAsync('git init', { cwd: output });

  // Set temporary Git user configuration.
  await execAsync('git config user.email "zephyrbot@zephyr-cloud.io"', {
    cwd: output,
  });
  await execAsync('git config user.name "Zephyr Bot"', { cwd: output });

  // Stage all files and commit them.
  await execAsync('git add .', { cwd: output });
  await execAsync('git commit --no-gpg-sign -m "Initial commit from Zephyr"', {
    cwd: output,
  });

  // Remove the temporary local Git configuration so that the user's global
  // settings will be used for future commits.
  await execAsync('git config --unset user.email', { cwd: output });
  await execAsync('git config --unset user.name', { cwd: output });
} else {
  log.warn(
    'Zephyr requires a Git repository to work properly, please create it manually afterwards.'
  );
}

const repoName = path.basename(output);

if (projectKind === 'web') {
  note(
    `
cd ./${repoName}
pnpm install
pnpm run build
`.trim(),
    'Run the application!'
  );
} else {
  note(
    c`
cd ./${repoName}
pnpm install
git remote add origin https://github.com/{cyan <name>}/{cyan ${repoName}}.git
{cyan ZC=1} pnpm start
`.trim(),
    'Run the application!'
  );

  note(
    c`
Make sure to commit and add a remote to the remote repository!
Read more about how Module Federation works with Zephyr:
- {cyan https://docs.zephyr-cloud.io/how-to/mf-guide}
    `.trim(),
    'Read more about Module Federation'
  );
}

note(
  c`
- {cyan ${terminalLink('Discord', 'https://zephyr-cloud.io/discord')}}
- {cyan ${terminalLink(
    'Documentation',
    projectKind === 'web'
      ? 'https://docs.zephyr-cloud.io/recipes'
      : 'https://docs.zephyr-cloud.io/recipes/repack-mf'
  )}}
- {cyan ${terminalLink(
    'Open an issue',
    'https://github.com/ZephyrCloudIO/zephyr-packages/issues'
  )}}
`.trim(),
  'Next steps.'
);
