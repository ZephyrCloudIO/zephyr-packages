import { ze_log } from '../logging';
import { logFn } from '../logging/ze-log-event';
import { validateOrgName, validateProjectName, zephyrPrompt } from './ze-styled-prompts';

export interface InteractiveGitInfo {
  org: string;
  project: string;
}

/**
 * Prompts the user interactively for organization and project information when git
 * information is not available.
 */
export async function promptForGitInfo(
  defaultProject: string
): Promise<InteractiveGitInfo> {
  ze_log.git('Starting interactive prompts for missing git information');

  // Show strong warning about proper setup
  logFn(
    'warn',
    'Manual configuration is NOT recommended and WILL cause errors in production.'
  );
  logFn('warn', '');
  logFn('warn', 'To properly use Zephyr, you MUST:');
  logFn('warn', '  1. Initialize git: git init');
  logFn('warn', '  2. Add remote: git remote add origin git@github.com:ORG/REPO.git');
  logFn('warn', '  3. Commit your changes: git add . && git commit -m "Initial commit"');
  logFn('warn', '');
  logFn('warn', 'Alternative: Use our CLI for automatic setup: npx create-zephyr-app');
  logFn('warn', '📚 Documentation: https://docs.zephyr-cloud.io\n');

  const org = await zephyrPrompt({
    message: 'What organization should this project belong to?',
    placeholder: 'my-organization',
    validate: validateOrgName,
  });

  const project = await zephyrPrompt({
    message: 'What is the project name?',
    placeholder: defaultProject,
    defaultValue: defaultProject,
    validate: validateProjectName,
  });

  const result = {
    org: org.trim(),
    project: project.trim(),
  };

  ze_log.git('User provided git info via prompts', result);

  // Remind user about proper setup after collecting info
  logFn('warn', '⚠️  Configuration accepted for THIS BUILD ONLY.');
  logFn('warn', 'This manual configuration will NOT work for production deployments.');
  logFn(
    'warn',
    'Zephyr REQUIRES a proper git repository with remote origin to function correctly.'
  );
  logFn(
    'warn',
    'Please set up git before your next deployment: https://docs.zephyr-cloud.io'
  );

  return result;
}

/** Checks if we're in an interactive terminal environment where prompts can be shown. */
export function isInteractiveTerminal(): boolean {
  return process.stdout.isTTY === true && process.stdin.isTTY === true;
}
