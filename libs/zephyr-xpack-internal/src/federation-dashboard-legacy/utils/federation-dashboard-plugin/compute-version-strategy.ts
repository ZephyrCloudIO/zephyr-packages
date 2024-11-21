import { execSync } from 'node:child_process';

export let gitSha: string | undefined;
try {
  gitSha = execSync('git rev-parse HEAD').toString().trim();
} catch (e) {
  console.error(e);
}

export const computeVersionStrategy = (
  stats: {
    hash?: string;
  },
  arg: string | undefined
): string | undefined => {
  switch (arg) {
    case 'gitSha':
      return gitSha;
    case 'buildHash':
      return stats.hash;
    default:
      return arg ? arg.toString() : gitSha;
  }
};
