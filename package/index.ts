#!/usr/bin/env node
import { setTimeout } from 'node:timers/promises';
import { execSync } from 'node:child_process';
import {
  spinner,
  group,
  intro,
  outro,
  isCancel,
  password,
  cancel,
  text,
  note,
  confirm,
  select,
  multiselect,
  tasks,
  log,
  updateSettings,
} from '@clack/prompts';
import { cyan, underline, bgCyan, black } from 'picocolors';
import { TEMPLATES } from './utils/constants';
import fs from 'node:fs/promises';
import create from './create/create';
import { CLIOptions } from './utils/types';

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
  intro(`${bgCyan(black(' Create federated applications with Zephyr '))}`);

  const project = await group(
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
      pkg_manager: () =>
        select({
          message: 'What package manager you are using?',
          initialValue: 'pnpm',
          options: [
            {
              value: 'pnpm',
              label: 'pnpm',
            },
            {
              value: 'npm',
              label: 'npm',
            },
            {
              value: 'yarn',
              label: 'yarn',
            },
            {
              value: 'bun',
              label: 'bun',
            },
          ],
        }),
      type: () =>
        select({
          message: 'What type of project you are creating?',
          initialValue: 'react-native',
          options: [
            {
              value: 'web',
              label: 'Web',
            },
            {
              value: 'react-native',
              label: 'React Native',
              hint: 'You will be building React Native powered by Re.Pack.',
            },
          ],
        }),
      templates: ({ results }) => {
        if (results.type === 'web') {
          return select({
            message: 'Pick a template: ',
            initialValue: 'react-rspack-mf',
            maxItems: 5,
            options: Object.keys(TEMPLATES).map((template) => {
              return {
                value: template as keyof typeof TEMPLATES,
                label: cyan(TEMPLATES[template as keyof typeof TEMPLATES].label),
                hint: TEMPLATES[template as keyof typeof TEMPLATES].hint
              }
            })
          })
        }
        note('Recommended names for React Native apps are CamelCase.')
        return text({
          message: `How would you like to call your host app?`,
          placeholder: 'host',
          validate: value => {
            if (!/^[a-zA-Z0-9-_@/]+$/.test(value)) return 'Please enter valid text';
            if (value[0] === '.') return 'Please enter a name without a dot prefix';
          },
        })
      },
      remote_name: ({ results }) => {
        if (results.type === 'react-native') {
          note('You can pass in an array of remote apps to be used in the host app separated by commas. Ex: remote1,remote2,remote3')
          return text({
            message: `How would you like to call your remote app?`,
            placeholder: 'remote',
            validate: value => {
              if (!/^[a-zA-Z0-9-_@/,]+$/.test(value)) return 'Please enter valid text without whitespaces';
              if (value[0] === '.') return 'Please enter a name without a dot prefix';
            },
          })
        }
      },

      install: () =>
        confirm({
          message: 'Install dependencies?',
          initialValue: false,
        }),
    },
    {
      onCancel: () => {
        cancel('Operation cancelled.');
        process.exit(0);
      },
    },
  );


  await create(project as unknown as CLIOptions)

  if (project.install) {

    const s = spinner();
    try {
      s.start(`Installing via ${project.pkg_manager}...`);
      await execSync(`cd ${project.path}`)
      await execSync(`${project.pkg_manager} install`)

      s.stop('Installed via pnpm');

    } catch (error) {
      log.error(error as string)
      cancel('Operation cancelled.')
      process.exit(0)
    }
  }

  execSync(`rm -rf .git`)

  const next_steps = `1. cd ${project.path}        \n2. ${project.install ? '' : 'pnpm install\n'}3. git init\n4. Create a new git repo and push your code to it\n5. ${project.pkg_manager} run build`;

  note(next_steps, 'Next steps.');

  const end_notes = [`Discord: ${underline(cyan('https://zephyr-cloud.io/discord'))}`,
  `Documentation: ${underline(cyan('https://zephyr-cloud.io/docs'))}`,
  `Open an issue: ${underline(cyan('https://github.com/ZephyrCloudIO/create-zephyr-apps/issues'))}`
  ]

  note(Object.values(end_notes).join('\n'), 'Problems?')

}

main().catch(console.error);

