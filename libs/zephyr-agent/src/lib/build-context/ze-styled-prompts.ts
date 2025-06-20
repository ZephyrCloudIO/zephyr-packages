import * as readline from 'node:readline';
import { logFn } from '../logging/ze-log-event';
import { bold, bgGreenBright, black } from '../logging/picocolor';

interface PromptOptions {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  validate?: (value: string) => string | undefined;
}

/** Custom prompt implementation that matches Zephyr's visual style */
export async function zephyrPrompt(options: PromptOptions): Promise<string> {
  const { message, placeholder, defaultValue, validate } = options;

  // Display the prompt message with Zephyr styling
  process.stdout.write('\n');
  logFn('info', message);

  const displayPlaceholder = placeholder || defaultValue || '';
  const promptPrefix = bold(bgGreenBright(black(' PROMPT ')));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    // Create the prompt with default value inline
    const promptText = displayPlaceholder
      ? `${promptPrefix}  (${displayPlaceholder}) > `
      : `${promptPrefix}  > `;

    rl.question(promptText, (input) => {
      const value = input.trim() || defaultValue || '';

      if (validate) {
        const error = validate(value);
        if (error) {
          logFn('error', error);
          rl.close();
          // Recursively call for retry
          zephyrPrompt(options).then(resolve).catch(reject);
          return;
        }
      }

      rl.close();
      resolve(value);
    });

    rl.on('SIGINT', () => {
      console.log(); // New line before the warning
      logFn('warn', 'Operation cancelled by user');
      rl.close();
      process.exit(1);
    });
  });
}

/** Validates organization name format */
export function validateOrgName(value: string): string | undefined {
  if (!value || value.trim().length === 0) {
    return 'Organization name is required';
  }
  if (!/^[a-zA-Z0-9-]+$/.test(value.trim())) {
    return 'Organization name can only contain letters, numbers, and hyphens';
  }
  return undefined;
}

/** Validates project name format */
export function validateProjectName(value: string): string | undefined {
  if (!value || value.trim().length === 0) {
    return 'Project name is required';
  }
  if (!/^[a-zA-Z0-9-]+$/.test(value.trim())) {
    return 'Project name can only contain letters, numbers, and hyphens';
  }
  return undefined;
}
