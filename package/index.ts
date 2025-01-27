#!/usr/bin/env node
import { setTimeout } from 'node:timers/promises';
import { exec } from 'node:child_process';
import end_note from './utils/end'
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
import c from "chalk";
import { TEMPLATES } from './utils/constants';
import { CLIOptions } from './utils/types';
import * as tempy from 'tempy';
import path from 'path';
import * as fs from 'node:fs'


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

      type: () =>
        select({
          message: 'What type of project you are creating?',
          initialValue: 'web',
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
                label: c.cyan(TEMPLATES[template as keyof typeof TEMPLATES].label),
                hint: TEMPLATES[template as keyof typeof TEMPLATES].hint
              }
            })
          })
        }
      },

    },
    {
      onCancel: () => {
        cancel('Operation cancelled.');
        process.exit(0);
      },
    },
  ) as CLIOptions;



  const temp_dir = tempy.temporaryDirectory()

  const command_web = `git clone --depth 1 https://github.com/ZephyrCloudIO/zephyr-examples.git -b main ${temp_dir}`
  const command_react_native = `git clone --depth 1 https://github.com/ZephyrCloudIO/zephyr-repack-example.git -b main ${temp_dir}`

  const project_path = project.path.replace('./', '').trim()

  const s = spinner()
  s.start(c.cyan(`Creating project in ${project_path}`))
  if (project.type === 'web') {


    exec(command_web, async (err, stdout, stderr) => {

      if (err) {
        s.stop(c.bgRed(c.black(`Error cloning ${command_web} to ${project_path}...`)))
        console.error(err);
        process.exit(0);

      }

      if (!err) {
        const outputPath = path.join(process.cwd(), project.path);

        const clonedPath = path.join(temp_dir, 'examples', project.templates as string)

        try {
          const result2 = await fs.promises.cp(clonedPath, outputPath, {
            recursive: true,
            force: true
          });

          s.stop(c.green(`Project successfully created at ${c.underline(project_path)}`))

        } catch (error) {
          console.error(c.bgRed(c.black(`Error cloning to ${project_path}...`)))
          console.error(error)
          process.exit(2)
        } finally {
          await fs.promises.rm(temp_dir, { recursive: true, force: true })
          end_note({ project })
        }
      }
    })

  }


  if (project.type === 'react-native') {


    exec(command_react_native, async (err, stdout, stderr) => {
      if (err) {
        s.stop(c.bgRed(c.black(`Error cloning to ${project_path}...`)))
        console.error(err)
        process.exit(2)
      }

      if (!err) {

        const outputPath = path.join(process.cwd(), project.path);
        try {
          const result2 = await fs.promises.cp(temp_dir, outputPath, {
            recursive: true,
            force: true
          });
          s.stop(c.green(`Project successfully created at ${c.underline(project_path)}`))
        } catch (error) {
          s.stop(c.bgRed(c.black(`Error clonin to ${project_path}`)))
          console.error(error)
          process.exit(2)
        } finally {
          await fs.promises.rm(temp_dir, { recursive: true, force: true })
          end_note({ project })
        }

      }
    })
  }


}

main().catch(console.error);

