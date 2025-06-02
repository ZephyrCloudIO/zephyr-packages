import {
  Tree,
  formatFiles,
  installPackagesTask,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  updateProjectConfiguration,
  addProjectConfiguration,
} from '@nx/devkit';
import { ZephyrPackageGeneratorSchema } from './schema';
import * as path from 'path';

interface NormalizedSchema extends ZephyrPackageGeneratorSchema {
  projectName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
}

function normalizeOptions(
  tree: Tree,
  options: ZephyrPackageGeneratorSchema
): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}`
    : 'libs';

  // Generate full package name based on type and bundler
  let projectName: string;
  if (options.packageType === 'plugin' && options.bundler) {
    projectName = `zephyr-${options.bundler}-plugin`;
  } else if (options.packageType === 'agent') {
    projectName = `zephyr-agent`;
  } else if (options.packageType === 'internal') {
    projectName = `zephyr-${name}-internal`;
  } else {
    projectName = `zephyr-${name}`;
  }

  const projectRoot = joinPathFragments(projectDirectory, projectName);

  return {
    ...options,
    projectName,
    projectRoot,
    projectDirectory,
    parsedTags: [],
  };
}

function addFiles(tree: Tree, options: NormalizedSchema) {
  const templateOptions = {
    ...options,
    ...names(options.name),
    offsetFromRoot: '../../',
    template: '',
  };
  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    options.projectRoot,
    templateOptions
  );
}

export default async function (tree: Tree, options: ZephyrPackageGeneratorSchema) {
  const normalizedOptions = normalizeOptions(tree, options);

  addFiles(tree, normalizedOptions);

  // Add project configuration
  addProjectConfiguration(tree, normalizedOptions.projectName, {
    root: normalizedOptions.projectRoot,
    projectType: 'library',
    sourceRoot: `${normalizedOptions.projectRoot}/src`,
    targets: {
      build: {
        executor: '@nx/js:tsc',
        outputs: ['{options.outputPath}'],
        options: {
          rootDir: `${normalizedOptions.projectRoot}/src`,
          outputPath: `${normalizedOptions.projectRoot}/dist`,
          tsConfig: `${normalizedOptions.projectRoot}/tsconfig.lib.json`,
          main: `${normalizedOptions.projectRoot}/src/index.ts`,
        },
      },
      lint: {
        executor: '@nx/eslint:lint',
      },
      ...(options.addTests && {
        test: {
          executor: '@nx/jest:jest',
          outputs: ['{workspaceRoot}/coverage/{projectRoot}'],
          options: {
            jestConfig: `${normalizedOptions.projectRoot}/jest.config.ts`,
          },
        },
      }),
      release: {
        command: `pnpm dist-tag add ${normalizedOptions.projectName}@$(npm view ${normalizedOptions.projectName}@next version) latest`,
      },
    },
    tags: normalizedOptions.parsedTags,
  });

  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}
