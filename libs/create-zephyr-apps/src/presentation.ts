import path from 'node:path';
import type { ProjectType } from './templates.js';

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

  if (options.projectType === 'react-native') {
    const repositoryName = path.basename(options.outputDirectory);
    const commands = [
      changeDirectory,
      ...(options.alreadyBuilt ? [] : [`${options.packageManager} install`]),
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

  return {
    commands: options.alreadyBuilt
      ? changeDirectory
      : [
          changeDirectory,
          `${options.packageManager} install`,
          `${options.packageManager} run build`,
        ].join('\n'),
    commandsTitle: options.alreadyBuilt
      ? 'Project built successfully!'
      : 'Run the application!',
    documentationUrl: 'https://docs.zephyr-cloud.io/bundlers/rsbuild',
  };
}

export function formatScaffoldFailure(error: ScaffoldFailurePresentation): string {
  const lastFailure = error.receipt.failures[error.receipt.failures.length - 1];
  const stderr = lastFailure?.stderr?.trim();
  return stderr ? `${error.message}\n\n${stderr}` : error.message;
}
