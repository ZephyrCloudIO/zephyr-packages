export interface CliOptions {
  directory: string;
  target?: 'web' | 'ios' | 'android';
  verbose?: boolean;
}

/** Parse command line arguments. Simple argument parsing without external dependencies. */
export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    directory: './dist',
  };

  // Track if we've seen the directory argument
  let directorySet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--target' || arg === '-t') {
      const value = args[++i];
      if (value && ['web', 'ios', 'android'].includes(value)) {
        options.target = value as 'web' | 'ios' | 'android';
      }
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      // First non-flag argument is the directory
      if (!directorySet) {
        options.directory = arg;
        directorySet = true;
      }
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Usage: zephyr <directory> [options]

Upload assets from a build directory to Zephyr.

Arguments:
  <directory>              Directory containing built assets (default: ./dist)

Options:
  --target, -t <target>    Build target: web, ios, or android (default: web)
  --verbose, -v            Enable verbose output
  --help, -h               Show this help message

Examples:
  zephyr ./dist
  zephyr ./build --target web
  zephyr ./dist --target ios --verbose

Note: No configuration file is needed. Zephyr will automatically detect
application information from your package.json and git repository.
`);
}
