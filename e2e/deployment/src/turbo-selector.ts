import { execFileSync } from 'node:child_process';
import path from 'node:path';

export function getTurboPackageSelector(forceAllExamples: boolean): string[] {
  return forceAllExamples ? ['--filter=./examples/*'] : ['--affected'];
}

export function getRepositoryRoot(testSourceDirectory: string): string {
  return path.resolve(testSourceDirectory, '../../..');
}

export function listTurboPackages(
  forceAllExamples: boolean,
  repositoryRoot: string
): Buffer {
  return execFileSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    [
      'exec',
      'turbo',
      'ls',
      ...getTurboPackageSelector(forceAllExamples),
      '--output=json',
    ],
    {
      cwd: repositoryRoot,
      shell: process.platform === 'win32',
    }
  );
}
