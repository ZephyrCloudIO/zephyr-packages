import {
  isZephyrBuildTarget,
  ZEPHYR_BUILD_TARGETS,
  type ZephyrBuildTarget,
} from 'zephyr-edge-contract';
import { MAX_ONLINE_TIMEOUT_MS } from './doctor/online-limits';

export interface CliOptions {
  command: 'run' | 'deploy' | 'watch' | 'doctor';
  commandLine?: string; // For 'run' command
  directory?: string; // For 'deploy', 'watch', and 'doctor' commands
  format?: 'json' | 'text'; // For 'doctor' and 'deploy'
  online?: boolean; // For 'doctor': also check Zephyr over the network
  timeoutMs?: number; // For 'doctor --online': limit for each check
  target?: ZephyrBuildTarget;
  verbose?: boolean;
  ssr?: boolean;
  debounceMs?: number;
  /** JSON sidecar containing Module Federation publication metadata. */
  metadataPath?: string;
  /** For 'deploy': path of a zephyr.config.json. */
  configPath?: string;
  /** For 'deploy': replaces the config's include globs. Repeatable. */
  include?: string[];
  /** For 'deploy': replaces the config's exclude globs. Repeatable. */
  exclude?: string[];
  /** For 'deploy': replaces the config's upload root. */
  output?: string;
  /** For 'deploy': list the files that would be uploaded and stop. */
  dryRun?: boolean;
}

const OPTIONS_WITH_VALUE = new Set([
  '--target',
  '-t',
  '--metadata',
  '--debounce',
  '--config',
  '--include',
  '--exclude',
  '--output',
]);

const DEPLOY_ONLY_FLAGS = new Set([
  '--config',
  '--include',
  '--exclude',
  '--output',
  '--dry-run',
]);

/**
 * Whether the arguments ask for `deploy --format json`. It does not validate the
 * arguments, so a parse error can still be reported as the one JSON document.
 */
export function isJsonDeploy(args: string[]): boolean {
  let index = 0;
  while (index < args.length && args[index].startsWith('-')) {
    index += OPTIONS_WITH_VALUE.has(args[index]) ? 2 : 1;
  }
  if (args[index] !== 'deploy') return false;
  // As in parseArgs: options start after the directory, and the last `--format` wins.
  let format: string | undefined;
  for (let i = index + 2; i < args.length; i++) {
    if (args[i] === '--format') format = args[++i];
    else if (args[i].startsWith('--format=')) format = args[i].slice('--format='.length);
    else if (OPTIONS_WITH_VALUE.has(args[i])) i++;
  }
  return format === 'json';
}

/**
 * Parse command line arguments.
 *
 * Syntax:
 *
 * - Ze-cli [options] <command> [args...] - run command (default)
 * - Ze-cli deploy <directory> [options] - deploy command
 * - Ze-cli watch <directory> [options] - watch and publish command
 * - Ze-cli doctor [directory] [--format json|text] [--online [--timeout ms]] - inspect
 *   without mutation
 *
 * Examples:
 *
 * - Ze-cli --ssr pnpm build
 * - Ze-cli tsc
 * - Ze-cli NODE_ENV=production webpack
 * - Ze-cli deploy ./dist
 * - Ze-cli deploy ./dist --target tap-app --metadata ./dist/zephyr-publication.json
 * - Ze-cli watch ./dist --target tap-app
 * - Ze-cli doctor . --format json
 * - Ze-cli doctor . --online
 * - Ze-cli deploy ./dist --ssr
 * - Ze-cli deploy ./dist --format json
 * - Ze-cli deploy ./dist --dry-run
 * - Ze-cli deploy ./dist --include 'assets/**' --exclude 'assets/*.map'
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
    } else if (DEPLOY_ONLY_FLAGS.has(arg)) {
      throw new Error(`${arg} can only be used with the deploy command.`);
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
  if (firstArg === 'doctor') {
    options.command = 'doctor';
    const possibleDirectory = args[commandStartIndex + 1];
    const hasDirectory = Boolean(possibleDirectory && !possibleDirectory.startsWith('-'));
    options.directory = hasDirectory ? possibleDirectory : '.';
    options.format = 'text';

    for (let i = commandStartIndex + (hasDirectory ? 2 : 1); i < args.length; i++) {
      const arg = args[i];
      if (arg === '--format') {
        const value = args[++i];
        if (value !== 'json' && value !== 'text') {
          throw new Error('--format must be either json or text.');
        }
        options.format = value;
      } else if (arg === '--online') {
        options.online = true;
      } else if (arg === '--timeout') {
        const value = Number(args[++i]);
        if (!Number.isSafeInteger(value) || value < 1 || value > MAX_ONLINE_TIMEOUT_MS) {
          throw new Error(
            `--timeout must be an integer from 1 to ${MAX_ONLINE_TIMEOUT_MS} (milliseconds).`
          );
        }
        options.timeoutMs = value;
      } else {
        throw new Error(`Unknown doctor option: ${String(arg)}`);
      }
    }
    if (options.timeoutMs !== undefined && !options.online) {
      throw new Error('--timeout can only be used with --online.');
    }
  } else if (firstArg === 'deploy' || firstArg === 'watch') {
    options.command = firstArg;
    const directory = args[commandStartIndex + 1];

    if (!directory) {
      console.error(`Error: ${firstArg} command requires a directory argument`);
      console.error(`Usage: ze-cli ${firstArg} <directory> [options]`);
      process.exit(1);
    }

    options.directory = directory;

    // Parse any additional flags after the directory. Value flags accept both
    // `--flag value` and `--flag=value`.
    for (let i = commandStartIndex + 2; i < args.length; i++) {
      const rawArg = args[i];
      const equalsAt = rawArg.startsWith('--') ? rawArg.indexOf('=') : -1;
      const inlineValue = equalsAt === -1 ? undefined : rawArg.slice(equalsAt + 1);
      const arg = equalsAt === -1 ? rawArg : rawArg.slice(0, equalsAt);
      if (
        inlineValue !== undefined &&
        !OPTIONS_WITH_VALUE.has(arg) &&
        arg !== '--format'
      ) {
        throw new Error(
          firstArg === 'deploy'
            ? `Unknown deploy option: ${rawArg}`
            : `${arg} does not take a value.`
        );
      }
      const takeValue = (): string | undefined => inlineValue ?? args[++i];

      if (arg === '--ssr') {
        options.ssr = true;
      } else if (arg === '--target' || arg === '-t') {
        const value = takeValue();
        if (isZephyrBuildTarget(value)) {
          options.target = value;
        } else {
          throw new Error(`Unsupported Zephyr build target: ${String(value)}`);
        }
      } else if (arg === '--metadata') {
        const value = takeValue();
        if (!value || value.startsWith('-')) {
          throw new Error('--metadata requires a JSON sidecar path.');
        }
        options.metadataPath = value;
      } else if (arg === '--debounce') {
        const value = Number(takeValue());
        if (!Number.isSafeInteger(value) || value < 0) {
          throw new Error(
            `--debounce must be a non-negative integer, received ${String(value)}`
          );
        }
        options.debounceMs = value;
      } else if (arg === '--verbose') {
        options.verbose = true;
      } else if (DEPLOY_ONLY_FLAGS.has(arg)) {
        if (firstArg !== 'deploy') {
          throw new Error(`${arg} can only be used with the deploy command.`);
        }
        const value = arg === '--dry-run' ? undefined : takeValue();
        if (arg !== '--dry-run' && (!value || value.startsWith('-'))) {
          throw new Error(`${arg} requires a value.`);
        }
        if (arg === '--config') options.configPath = value;
        else if (arg === '--output') options.output = value;
        else if (arg === '--include' && value) (options.include ??= []).push(value);
        else if (arg === '--exclude' && value) (options.exclude ??= []).push(value);
        else if (arg === '--dry-run') options.dryRun = true;
      } else if (arg === '--format' && firstArg === 'deploy') {
        const value = takeValue();
        if (value !== 'json' && value !== 'text') {
          throw new Error('--format must be either json or text.');
        }
        options.format = value;
      } else if (firstArg === 'deploy') {
        // A mistyped flag such as --dry-ryn must never turn a dry run into an upload.
        throw new Error(
          rawArg.startsWith('-')
            ? `Unknown deploy option: ${rawArg}`
            : `Unexpected extra argument: ${rawArg}. deploy takes one directory.`
        );
      }
    }
  } else {
    // It's a run command - everything from commandStartIndex onwards is the command
    options.command = 'run';
    options.commandLine = args.slice(commandStartIndex).join(' ');
  }

  return options;
}

function formatBuildTargets(): string {
  const targets = [...ZEPHYR_BUILD_TARGETS];
  const last = targets.pop();
  return targets.length > 0 ? `${targets.join(', ')}, or ${last}` : String(last);
}

function printHelp(): void {
  console.log(`
Usage: ze-cli [options] <command> [args...]
       ze-cli deploy <directory> [options]
       ze-cli doctor [directory] [--format json|text] [--online [--timeout ms]]

Run a build command and automatically upload assets to Zephyr, or deploy
pre-built assets from a directory.

Commands:
  <command> [args...]      Run a build command and upload (default)
  deploy <directory>       Upload pre-built assets from a directory
  watch <directory>        Watch pre-built output and publish each settled change
  doctor [directory]       Inspect project readiness without installing or building

Options:
  --ssr                    Mark this snapshot as server-side rendered
  --target, -t <target>    Build target: ${formatBuildTargets()} (default: web)
  --metadata <path>        JSON sidecar for Module Federation publication metadata
  --debounce <milliseconds>  Delay output-watch publications after changes (default: 250)
  --config <path>          Deploy only: zephyr.config.json to use (default:
                           <directory>/zephyr.config.json)
  --include <glob>         Deploy only: upload files matching this glob, relative to the
                           upload root. Repeatable. Replaces the config's include list
  --exclude <glob>         Deploy only: skip files matching this glob. Repeatable.
                           Replaces the config's exclude list
  --output <directory>     Deploy only: upload root, relative to the config's folder.
                           Replaces the config's output
  --dry-run                Deploy only: list the files that would be uploaded and stop.
                           Needs no sign-in and makes no network request
  --verbose                Enable verbose output
  --format <json|text>     Doctor report format, or deploy result format; json prints
                           one JSON document on stdout and logs on stderr, also when
                           deploy fails (default: text)
  --online                 Doctor only: also check that Zephyr can be reached and that
                           the token and application work (read-only network requests)
  --timeout <milliseconds> Doctor --online only: limit for each check (default: 5000)
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

  # Choose the files to upload (example only, not guidance)
  ze-cli deploy ./worker --dry-run
  ze-cli deploy ./worker --include '**/*' --exclude '**/*.css' --dry-run

  # Inspect without mutation
  ze-cli doctor .
  ze-cli doctor ./apps/host --format json
  ze-cli doctor . --online

  # Build without deploying (no Zephyr request, no token, no git information)
  ZE_DISABLED=true ze-cli pnpm build

How it works:
  - For run commands, ze-cli executes your build command and automatically
    detects the output directory to upload assets.
  - For deploy commands, ze-cli uploads assets from the specified directory.
  - For watch commands, ze-cli publishes each settled output change as a new immutable
    snapshot. The Zephyr control plane authorizes and advances any development tag.
  - The doctor command only reads project, package, config, lockfile, and diagnostic
    artifact metadata. It never installs, edits, builds, or deploys. By default it makes
    no network request. With --online it also sends read-only requests to Zephyr to
    check the API, the gateway, the token (sent as a bearer header, never stored or
    changed), the application configuration and the edge URL.
  - With ZE_DISABLED=true, ze-cli runs the build and does not contact Zephyr. It says that
    the bundle is not deployed.
  - All stdout/stderr from build commands are passed through.
  - ze-cli logs are written to stderr only.

Note: No configuration file is needed. Zephyr will automatically detect
application information from your package.json and git repository. To choose the
files that deploy uploads, add a zephyr.config.json next to the output (JSON Schema:
zephyr-cli/zephyr.config.schema.json). Files such as .env, .dev.vars, *.pem and *.key
are never uploaded, with or without a configuration file. A folder holding a
wrangler.toml, wrangler.json or wrangler.jsonc is refused unless a zephyr.config.json
is present, and TypeScript source files are refused: upload compiled output only.

For more information: https://docs.zephyr-cloud.io/cli
`);
}
