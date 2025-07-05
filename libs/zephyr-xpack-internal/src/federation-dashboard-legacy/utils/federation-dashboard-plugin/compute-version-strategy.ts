import { execSync } from 'node:child_process';

export let gitSha: string | undefined;
try {
  gitSha = execSync('git rev-parse HEAD', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'], // Prevent stderr from being inherited
  })
    .toString()
    .trim();
} catch {
  // Silently fail - git may not be available or repository may have no commits
  gitSha = undefined;
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
