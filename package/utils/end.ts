import { exec } from 'node:child_process';
import { note } from '@clack/prompts';
import c from 'chalk';
import type { CLIOptions } from './types';

export default function end_note({ project }: { project: CLIOptions }) {
  try {
    exec(`${project.path} && git config user.name`, (err, stdout, stderr) => {
      console.log(stdout);

      const user_name = stdout.toString().trim();

      const repo_name = project.path.split('/').pop();

      let next_steps: string;

      if (project.type === 'web') {
        next_steps = `cd ${repo_name}        \npnpm install\ngit remote add origin https://github.com/${
          user_name ?? 'YourUsername'
        }/${repo_name}.git\npnpm run build`;
      } else {
        next_steps = `cd ${repo_name}        \npnpm install\nrm -rf .git\ngit remote set origin https://github.com/${
          user_name.length >= 1 ? user_name : 'YourUsername'
        }/${repo_name}.git\npnpm run build`;
      }

      note(next_steps, 'Next steps.');
    });
  } catch (error) {
    console.error(error);
  } finally {
    const end_notes = [
      `Discord: ${c.underline(c.cyan('https://zephyr-cloud.io/discord'))}`,
      `Documentation: ${c.underline(c.cyan('https://zephyr-cloud.io/docs'))}`,
      `Open an issue: ${c.underline(
        c.cyan('https://github.com/ZephyrCloudIO/create-zephyr-apps/issues'),
      )}`,
    ];

    note(Object.values(end_notes).join('\n'), 'Problems?');
  }
}
