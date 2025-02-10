#!/usr/bin/env node
import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import {
  cancel,
  confirm,
  group,
  intro,
  isCancel,
  note,
  select,
  spinner,
  text,
  updateSettings,
} from '@clack/prompts';
import c from 'chalk';
import * as tempy from 'tempy';
import { TEMPLATES } from './utils/constants';
import end_note from './utils/end';
import type { CLIOptions } from './utils/types';

/**
 * Helper function to execute a command in the given working directory.
 */
function runCmd(cmd: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error executing command: ${cmd}`, err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Initialize Git in the project directory, set temporary user configuration,
 * commit the changes, and then remove the local configuration.
 */
async function initializeGit(projectPath: string): Promise<void> {
  // Ask the user if they want to initialize a Git repository.
  const shouldInit = await confirm({
    message: 'Would you like to initialize a new Git repository?',
    initialValue: true,
  });

  if (isCancel(shouldInit)) {
    cancel('Operation cancelled');
    process.exit(0);
  }

  if (shouldInit) {
    // Initialize the repository.
    await runCmd('git init', projectPath);

    // Set temporary Git user configuration.
    await runCmd(
      'git config user.email "zephyrbot@zephyr-cloud.io"',
      projectPath,
    );
    await runCmd('git config user.name "Zephyr Bot"', projectPath);

    // Stage all files and commit them.
    await runCmd('git add .', projectPath);
    await runCmd('git commit -m "Initial commit from Zephyr"', projectPath);

    // Remove the temporary local Git configuration so that the user's global
    // settings will be used for future commits.
    await runCmd('git config --unset user.email', projectPath);
    await runCmd('git config --unset user.name', projectPath);
  }
}

async function main() {
  console.clear();

  await setTimeout(1000);

  updateSettings({
    aliases: {
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
    },
  });

  note('npx create-zephyr-apps@latest');
  intro(`${c.bgCyan(c.black(' Create federated applications with Zephyr '))}`);

  const project = (await group(
    {
      path: ({ results }) => {
        return text({
          message: 'Where should we create your project?',
          placeholder: './sparkling-solid',
          validate: value => {
            if (!value) return 'Please enter a path.';
            if (value[0] !== '.') return 'Please enter a relative path.';
          },
        });
      },

      type: () =>
        select({
          message: 'What type of project you are creating?',
          initialValue: 'web',
          options: [
            {
              value: 'web',
              label: 'Web',
              hint: 'You will be choosing from a selection of templates provided by us.',
            },
            {
              value: 'react-native',
              label: 'React Native',
              hint: 'This is a comprehensive example project provided by us. You will be building React Native powered by Re.Pack.',
            },
          ],
        }),

      templates: ({ results }) => {
        if (results.type === 'web') {
          return select({
            message: 'Pick a template: ',
            initialValue: 'react-rspack-mf',
            maxItems: 5,
            options: Object.keys(TEMPLATES).map(template => ({
              value: template as keyof typeof TEMPLATES,
              label: c.cyan(
                TEMPLATES[template as keyof typeof TEMPLATES].label,
              ),
              hint: TEMPLATES[template as keyof typeof TEMPLATES].hint,
            })),
          });
        }
      },
    },
    {
      onCancel: () => {
        cancel('Operation cancelled.');
        process.exit(0);
      },
    },
  )) as CLIOptions;

  const temp_dir = tempy.temporaryDirectory();
  const command_web = `git clone --depth 1 https://github.com/ZephyrCloudIO/zephyr-examples.git -b main ${temp_dir}`;
  const command_react_native = `git clone --depth 1 https://github.com/ZephyrCloudIO/zephyr-repack-example.git -b main ${temp_dir}`;

  const project_path = project.path.replace('./', '').trim();
  const s = spinner();
  s.start(c.cyan(`Creating project in ${project_path}`));
  const outputPath = path.join(process.cwd(), project.path);

  try {
    if (project.type === 'web') {
      await new Promise<void>((resolve, reject) => {
        exec(command_web, async err => {
          if (err) {
            s.stop(
              c.bgRed(
                c.black(`Error cloning repository to ${project_path}...`),
              ),
            );
            return reject(err);
          }

          const clonedPath = path.join(
            temp_dir,
            'examples',
            project.templates as string,
          );

          try {
            // Remove .git folder from the cloned template
            await fs.promises.rm(path.join(clonedPath, '.git'), {
              recursive: true,
              force: true,
            });

            await fs.promises.cp(clonedPath, outputPath, {
              recursive: true,
              force: true,
            });
            s.stop(
              c.green(
                `Project successfully created at ${c.underline(project_path)}`,
              ),
            );
            resolve();
          } catch (copyErr) {
            s.stop(
              c.bgRed(c.black(`Error copying template to ${project_path}...`)),
            );
            reject(copyErr);
          }
        });
      });
    } else if (project.type === 'react-native') {
      await new Promise<void>((resolve, reject) => {
        exec(command_react_native, async err => {
          if (err) {
            s.stop(
              c.bgRed(
                c.black(`Error cloning repository to ${project_path}...`),
              ),
            );
            return reject(err);
          }

          try {
            // Remove .git folder from the cloned template
            await fs.promises.rm(path.join(temp_dir, '.git'), {
              recursive: true,
              force: true,
            });

            await fs.promises.cp(temp_dir, outputPath, {
              recursive: true,
              force: true,
            });
            s.stop(
              c.green(
                `Project successfully created at ${c.underline(project_path)}`,
              ),
            );
            resolve();
          } catch (copyErr) {
            s.stop(
              c.bgRed(c.black(`Error copying files to ${project_path}...`)),
            );
            reject(copyErr);
          }
        });
      });
    }

    // Initialize Git only if user confirms
    await initializeGit(outputPath);
    note('Git repository and initial commit created successfully!');
  } catch (error) {
    console.error(error);
    process.exit(2);
  } finally {
    await fs.promises.rm(temp_dir, { recursive: true, force: true });
    end_note({ project });
  }
}

main().catch(console.error);
