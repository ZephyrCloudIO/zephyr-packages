import { isZephyrBuildTarget, type ZephyrBuildTarget } from 'zephyr-edge-contract';

export interface CliOptions {
  command: 'run' | 'deploy' | 'watch';
  commandLine?: string; // For 'run' command
  directory?: string; // For 'deploy' and 'watch' commands
  target?: ZephyrBuildTarget;
  verbose?: boolean;
  ssr?: boolean;
  debounceMs?: number;
  /** JSON sidecar containing Module Federation publication metadata. */
  metadataPath?: string;
}

/**
 * Parse command line arguments.
 *
 * Syntax:
 *
 * - Ze-cli [options] <command> [args...] - run command (default)
 * - Ze-cli deploy <directory> [options] - deploy command
 * - Ze-cli watch <directory> [options] - watch and publish command
 *
 * Examples:
 *
 * - Ze-cli --ssr pnpm build
 * - Ze-cli tsc
 * - Ze-cli NODE_ENV=production webpack
 * - Ze-cli deploy ./dist
 * - Ze-cli deploy ./dist --target tap-app --metadata ./dist/zephyr-publication.json
 * - Ze-cli watch ./dist --target tap-app
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
      if (isZephyrBuildTarget(value)) {
        options.target = value;
      } else {
        throw new Error(`Unsupported Zephyr build target: ${String(value)}`);
      }
      flags.push(arg, value);
    } else if (arg === '--metadata') {
      const value = args[++i];
      if (!value || value.startsWith('-')) {
        throw new Error('--metadata requires a JSON sidecar path.');
      }
      options.metadataPath = value;
      flags.push(arg, value);
    } else if (arg === '--debounce') {
      const value = Number(args[++i]);
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(
          `--debounce must be a non-negative integer, received ${String(value)}`
        );
      }
      options.debounceMs = value;
      flags.push(arg, value.toString());
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

  // Check if it's a directory-based subcommand.
  if (firstArg === 'deploy' || firstArg === 'watch') {
    options.command = firstArg;
    const directory = args[commandStartIndex + 1];

    if (!directory) {
      console.error(`Error: ${firstArg} command requires a directory argument`);
      console.error(`Usage: ze-cli ${firstArg} <directory> [options]`);
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
        if (isZephyrBuildTarget(value)) {
          options.target = value;
        } else {
          throw new Error(`Unsupported Zephyr build target: ${String(value)}`);
        }
      } else if (arg === '--metadata') {
        const value = args[++i];
        if (!value || value.startsWith('-')) {
          throw new Error('--metadata requires a JSON sidecar path.');
        }
        options.metadataPath = value;
      } else if (arg === '--debounce') {
        const value = Number(args[++i]);
        if (!Number.isSafeInteger(value) || value < 0) {
          throw new Error(
            `--debounce must be a non-negative integer, received ${String(value)}`
          );
        }
        options.debounceMs = value;
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
  watch <directory>        Watch pre-built output and publish each settled change

Options:
  --ssr                    Mark this snapshot as server-side rendered
  --target, -t <target>    Build target: web, ios, android, or tap-app (default: web)
  --metadata <path>        JSON sidecar for Module Federation publication metadata
  --debounce <milliseconds>  Delay output-watch publications after changes (default: 250)
  --verbose                Enable verbose output
  --help, -h               Show this help message

Examples:
  # Run build commands
  ze-cli pnpm build
  ze-cli yarn build
  ze-cli tsc
  ze-cli NODE_ENV=production webpack
  ze-cli --ssr pnpm build
  ze-cli --target tap-app --metadata ./dist/zephyr-publication.json pnpm build

  # Deploy pre-built assets
  ze-cli deploy ./dist
  ze-cli deploy ./dist --ssr
  ze-cli deploy ./build --target ios
  ze-cli deploy ./dist --target tap-app --metadata ./dist/zephyr-publication.json
  ze-cli watch ./dist --target tap-app

How it works:
  - For run commands, ze-cli executes your build command and automatically
    detects the output directory to upload assets.
  - For deploy commands, ze-cli uploads assets from the specified directory.
  - For watch commands, ze-cli publishes each settled output change as a new immutable
    snapshot. The Zephyr control plane authorizes and advances any development tag.
  - All stdout/stderr from build commands are passed through.
  - ze-cli logs are written to stderr only.

Note: No configuration file is needed. Zephyr will automatically detect
application information from your package.json and git repository.

For more information: https://docs.zephyr-cloud.io/cli
`);
}
