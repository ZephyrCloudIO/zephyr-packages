import { exec } from 'node:child_process';
import { note } from '@clack/prompts';
import c from 'chalk';
import type { CLIOptions } from './types';

export default function end_note({ project }: { project: CLIOptions }) {
  try {
    exec('git config user.name', (err, stdout, stderr) => {
      const user_name = stdout.toString().trim();
      const repo_name = project.path.split('/').pop();

      let next_steps: string[];

      if (project.type === 'web') {
        next_steps = [`cd ${repo_name}`, 'pnpm install', 'pnpm run build'];
      } else {
        next_steps = [
          `cd ${repo_name}`,
          'pnpm install',
          c.magenta(
            `git remote add origin https://github.com/${user_name.length >= 1 ? user_name : 'YourUsername'}/${repo_name}.git`,
          ),
          'ZC=1 pnpm run start',
          '\n--------------------------------\n',
          'Make sure to commit and add a remote to the remote repository!',
          `Read more about how Module Federation works with Zephyr: ${c.underline(c.cyan('https://docs.zephyr-cloud.io/how-to/mf-guide'))}`,
        ];
      }

      note(c.cyan(next_steps.join('\n')), 'Next steps.');
    });
  } catch (error) {
    console.error(error);
  } finally {
    const end_notes = [
      `Discord: ${c.underline(c.cyan('https://zephyr-cloud.io/discord'))}`,
      `Documentation: ${project.type === 'web' ? c.underline(c.cyan('https://docs.zephyr-cloud.io/recipes')) : c.underline(c.cyan('https://docs.zephyr-cloud.io/recipes/repack-mf'))}`,
      `Open an issue: ${c.underline(c.cyan('https://github.com/ZephyrCloudIO/create-zephyr-apps/issues'))}`,
    ];

    note(Object.values(end_notes).join('\n'), 'Problems?');
  }
}
