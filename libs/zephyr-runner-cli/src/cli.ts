export interface CliOptions {
  command: 'run' | 'deploy';
  commandLine?: string; // For 'run' command
  directory?: string; // For 'deploy' command
  target?: 'web' | 'ios' | 'android';
  verbose?: boolean;
  ssr?: boolean;
}

/**
 * Parse command line arguments.
 *
 * Syntax:
 *
 * - Ze-cli [options] <command> [args...] - run command (default)
 * - Ze-cli deploy <directory> [options] - deploy command
 *
 * Examples:
 *
 * - Ze-cli --ssr pnpm build
 * - Ze-cli tsc
 * - Ze-cli NODE_ENV=production webpack
 * - Ze-cli deploy ./dist
 * - Ze-cli deploy ./dist --ssr
 */
export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    command: 'run', // Default to 'run'
  };

  // Find where flags end and the command/subcommand begins
  let commandStartIndex = -1;
  const flags: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--version' || arg === '-v') {
      // Version is handled by the caller
      options.verbose = true;
    } else if (arg === '--ssr') {
      options.ssr = true;
      flags.push(arg);
    } else if (arg === '--target' || arg === '-t') {
      const value = args[++i];
      if (value && ['web', 'ios', 'android'].includes(value)) {
        options.target = value as 'web' | 'ios' | 'android';
      }
      flags.push(arg, value);
    } else if (arg === '--verbose') {
      options.verbose = true;
      flags.push(arg);
    } else if (!arg.startsWith('-')) {
      // First non-flag argument
      commandStartIndex = i;
      break;
    }
  }

  if (commandStartIndex === -1) {
    printHelp();
    process.exit(1);
  }

  const firstArg = args[commandStartIndex];

  // Check if it's a subcommand
  if (firstArg === 'deploy') {
    options.command = 'deploy';
    const directory = args[commandStartIndex + 1];

    if (!directory) {
      console.error('Error: deploy command requires a directory argument');
      console.error('Usage: ze-cli deploy <directory> [options]');
      process.exit(1);
    }

    options.directory = directory;

    // Parse any additional flags after the directory
    for (let i = commandStartIndex + 2; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--ssr') {
        options.ssr = true;
      } else if (arg === '--target' || arg === '-t') {
        const value = args[++i];
        if (value && ['web', 'ios', 'android'].includes(value)) {
          options.target = value as 'web' | 'ios' | 'android';
        }
      } else if (arg === '--verbose') {
        options.verbose = true;
      }
    }
  } else {
    // It's a run command - everything from commandStartIndex onwards is the command
    options.command = 'run';
    options.commandLine = args.slice(commandStartIndex).join(' ');
  }

  return options;
}

function printHelp(): void {
  console.log(`
Usage: ze-cli [options] <command> [args...]
       ze-cli deploy <directory> [options]

Run a build command and automatically upload assets to Zephyr, or deploy
pre-built assets from a directory.

Commands:
  <command> [args...]      Run a build command and upload (default)
  deploy <directory>       Upload pre-built assets from a directory

Options:
  --ssr                    Mark this snapshot as server-side rendered
  --target, -t <target>    Build target: web, ios, or android (default: web)
  --verbose                Enable verbose output
  --help, -h               Show this help message

Examples:
  # Run build commands
  ze-cli pnpm build
  ze-cli yarn build
  ze-cli tsc
  ze-cli NODE_ENV=production webpack
  ze-cli --ssr pnpm build

  # Deploy pre-built assets
  ze-cli deploy ./dist
  ze-cli deploy ./dist --ssr
  ze-cli deploy ./build --target ios

How it works:
  - For run commands, ze-cli executes your build command and automatically
    detects the output directory to upload assets.
  - For deploy commands, ze-cli uploads assets from the specified directory.
  - All stdout/stderr from build commands are passed through.
  - ze-cli logs are written to stderr only.

Note: No configuration file is needed. Zephyr will automatically detect
application information from your package.json and git repository.

For more information: https://docs.zephyr-cloud.io/cli
`);
}
