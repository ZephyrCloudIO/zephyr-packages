import path from 'node:path';
import { getTemplate, type ProjectType } from './templates.js';

export interface ScaffoldFailurePresentation {
  message: string;
  receipt: {
    failures: Array<{
      stderr?: string;
    }>;
  };
}

export interface CreateNextStepsOptions {
  outputDirectory: string;
  invocationDirectory: string;
  packageManager: string;
  projectType: ProjectType;
  template?: string;
  alreadyInstalled: boolean;
  alreadyBuilt: boolean;
}

export interface NextSteps {
  commands: string;
  commandsTitle: string;
  guidance?: {
    body: string;
    title: string;
  };
  documentationUrl: string;
}

export function createNextSteps(options: CreateNextStepsOptions): NextSteps {
  const relativeDirectory =
    path.relative(options.invocationDirectory, options.outputDirectory) ||
    path.basename(options.outputDirectory);
  const changeDirectory = `cd ./${relativeDirectory}`;
  const alreadyInstalled = options.alreadyInstalled || options.alreadyBuilt;

  if (options.projectType === 'react-native') {
    const repositoryName = path.basename(options.outputDirectory);
    const commands = [
      changeDirectory,
      ...(alreadyInstalled ? [] : [`${options.packageManager} install`]),
      `git remote add origin https://github.com/<name>/${repositoryName}.git`,
      `ZC=1 ${options.packageManager} start`,
    ];

    return {
      commands: commands.join('\n'),
      commandsTitle: 'Run the application!',
      guidance: {
        body: [
          'Make sure to commit and add a remote to the remote repository!',
          'Read more about how Module Federation works with Zephyr:',
          '- https://docs.zephyr-cloud.io/tutorials/mf-guide',
        ].join('\n'),
        title: 'Read more about Module Federation',
      },
      documentationUrl: 'https://docs.zephyr-cloud.io/bundlers/repack',
    };
  }

  const commands = [changeDirectory];
  if (!alreadyInstalled) {
    commands.push(`${options.packageManager} install`);
  }
  if (!options.alreadyBuilt) {
    commands.push(`${options.packageManager} run build`);
  }
  const bundlerDocumentation = options.template
    ? getTemplate(options.template)?.bundlerDocumentation
    : undefined;

  return {
    commands: commands.join('\n'),
    commandsTitle: options.alreadyBuilt
      ? 'Project built successfully!'
      : 'Run the application!',
    documentationUrl: bundlerDocumentation
      ? `https://docs.zephyr-cloud.io/bundlers/${bundlerDocumentation}`
      : 'https://docs.zephyr-cloud.io/getting-started/quick-start',
  };
}

export function formatScaffoldFailure(error: ScaffoldFailurePresentation): string {
  const lastFailure = error.receipt.failures[error.receipt.failures.length - 1];
  const stderr = lastFailure?.stderr?.trim();
  return stderr ? `${error.message}\n\n${stderr}` : error.message;
}
