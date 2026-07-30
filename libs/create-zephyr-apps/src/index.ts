#!/usr/bin/env node

import {
  cancel,
  confirm,
  intro,
  isCancel,
  note,
  select,
  spinner,
  text,
} from '@clack/prompts';
import c from 'chalk-template';
import * as fs from 'node:fs';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import terminalLink from 'terminal-link';
import {
  HELP_TEXT,
  listTemplatesJson,
  OperationCancelled,
  parseCliArgs,
  resolveCliOptions,
  shouldUseInteractiveMode,
  type PromptAdapter,
} from './cli.js';
import { createNextSteps, formatScaffoldFailure } from './presentation.js';
import { ScaffoldFailure, scaffoldProject } from './scaffold.js';
import {
  DEFAULT_WEB_TEMPLATE,
  ProjectTypes,
  Templates,
  type ProjectType,
} from './templates.js';

export async function main(args = process.argv.slice(2)): Promise<number> {
  const jsonRequested = args.includes('--json');
  let loading: ReturnType<typeof spinner> | undefined;
  let loadingStarted = false;

  try {
    const parsed = parseCliArgs(args);

    if (parsed.help) {
      console.log(HELP_TEXT);
      return 0;
    }

    if (parsed.version) {
      console.log(await readCliVersion());
      return 0;
    }

    if (parsed.listTemplates) {
      if (parsed.json) {
        console.log(listTemplatesJson());
      } else {
        console.log(
          Templates.map(
            (template) =>
              `${template.name.padEnd(30)} ${template.label} (${template.directory})`
          ).join('\n')
        );
      }
      return 0;
    }

    const interactive = shouldUseInteractiveMode(parsed, {
      inputIsTTY: process.stdin.isTTY,
      outputIsTTY: process.stdout.isTTY,
    });

    if (interactive) {
      console.clear();
      await setImmediate();
      intro(c`Bootstrap your project using {cyan Zephyr}!`);
      note(
        c`The only sane way to do micro-frontends\n{cyan https://docs.zephyr-cloud.io/}`,
        'Zephyr Cloud'
      );
    }

    const options = await resolveCliOptions(parsed, {
      interactive,
      prompts: interactive ? createPromptAdapter() : undefined,
    });
    loading = interactive ? spinner() : undefined;

    const receipt = await scaffoldProject(options, {
      onProgress(_stage, message) {
        if (loading) {
          if (loadingStarted) {
            loading.message(message);
          } else {
            loading.start(message);
            loadingStarted = true;
          }
        }
      },
    });

    if (loadingStarted) {
      loading?.stop(
        c`Project successfully created at {cyan ${
          path.relative(process.cwd(), receipt.directory) || './'
        }}!`
      );
      loadingStarted = false;
    }

    if (options.json) {
      console.log(JSON.stringify(receipt, null, 2));
    } else {
      printNextSteps(
        receipt.directory,
        receipt.packageManager.name,
        options.projectType,
        options.template,
        options.install,
        options.build
      );
    }
    return 0;
  } catch (error) {
    if (loadingStarted) {
      loading?.error('Project creation failed.');
    }

    if (error instanceof OperationCancelled) {
      cancel(error.message);
      return 0;
    }

    if (error instanceof ScaffoldFailure) {
      if (jsonRequested) {
        console.log(JSON.stringify(error.receipt, null, 2));
      } else {
        cancel(formatScaffoldFailure(error));
      }
      return error.exitCode;
    }

    const message = error instanceof Error ? error.message : String(error);
    if (jsonRequested) {
      console.log(
        JSON.stringify(
          {
            success: false,
            failures: [
              {
                stage: 'prepare',
                message,
                exitCode: 1,
              },
            ],
          },
          null,
          2
        )
      );
    } else {
      cancel(message);
    }
    return 1;
  }
}

function createPromptAdapter(): PromptAdapter {
  return {
    async directory() {
      const value = await text({
        message: 'Where should we create your project?',
        placeholder: './my-app',
        validate(input) {
          return input?.trim() ? undefined : 'Please enter a project name.';
        },
      });
      return isCancel(value) ? undefined : value;
    },
    async projectType() {
      const value = await select({
        message: 'What type of project are you creating?',
        initialValue: ProjectTypes[0].value,
        options: [...ProjectTypes],
        maxItems: 1,
      });
      return isCancel(value) ? undefined : (value as ProjectType);
    },
    async template() {
      const value = await select({
        message: 'Pick a template:',
        initialValue: DEFAULT_WEB_TEMPLATE,
        options: Templates.map((template) => ({
          value: template.name,
          label: template.label,
          hint: template.hint,
        })),
      });
      return isCancel(value) ? undefined : (value as string);
    },
    async initializeGit() {
      const value = await confirm({
        message: 'Would you like to initialize a new Git repository?',
        initialValue: true,
      });
      return isCancel(value) ? undefined : value;
    },
  };
}

function printNextSteps(
  outputDirectory: string,
  packageManager: string,
  projectType: ProjectType,
  template: string | undefined,
  alreadyInstalled: boolean,
  alreadyBuilt: boolean
): void {
  const nextSteps = createNextSteps({
    outputDirectory,
    invocationDirectory: process.cwd(),
    packageManager,
    projectType,
    template,
    alreadyInstalled,
    alreadyBuilt,
  });

  note(nextSteps.commands, nextSteps.commandsTitle);
  if (nextSteps.guidance) {
    note(nextSteps.guidance.body, nextSteps.guidance.title);
  }
  note(
    c`
- {cyan ${terminalLink('Discord', 'https://zephyr-cloud.io/discord')}}
- {cyan ${terminalLink('Documentation', nextSteps.documentationUrl)}}
- {cyan ${terminalLink(
      'Open an issue',
      'https://github.com/ZephyrCloudIO/zephyr-packages/issues'
    )}}
`.trim(),
    'Next steps.'
  );
}

async function readCliVersion(): Promise<string> {
  const packageJson = JSON.parse(
    await fs.promises.readFile(new URL('../package.json', import.meta.url), 'utf8')
  ) as { version: string };
  return packageJson.version;
}

void main().then((exitCode) => {
  process.exitCode = exitCode;
});
