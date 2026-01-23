#!/usr/bin/env node

import { generateZeTypes } from './lib/generate';

const HELP = `ze-types

Usage:
  ze-types login
  ze-types                       (default: read zephyr:dependencies)
  ze-types --url <zephyr-app-url> [--url <zephyr-app-url>]
  ze-types --from-package
  ze-types generate --url <zephyr-app-url>

Options:
  -u, --url <url>          Zephyr app URL or zephyr-manifest.json URL (repeatable)
  -r, --root <path>        Project root (defaults to cwd)
  --from-package           Read zephyr:dependencies from package.json
  --package <path>         Explicit package.json path or directory
  --token <token>          Zephyr auth token (or set ZE_SECRET_TOKEN)
  --no-login               Disable auto-login prompt
  --debug                  Verbose logging
  -h, --help               Show help

Env:
  ZE_TYPES_URLS            Comma-separated list of Zephyr URLs
  ZE_SECRET_TOKEN          Zephyr auth token for dependency resolution
  ZE_AUTH_TOKEN            Alternative auth token
  ZE_TOKEN                 Alternative auth token
  ZE_SERVER_TOKEN          Server token (requires ZE_USER_EMAIL)
  ZE_USER_EMAIL            Email for ZE_SERVER_TOKEN exchange
`;

type ParsedArgs = {
  command: 'generate' | 'login';
  urls: string[];
  root?: string;
  packageJsonPath?: string;
  usePackageJson: boolean;
  token?: string;
  debug: boolean;
  help: boolean;
  autoLogin: boolean;
};

function splitUrls(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseArgs(args: string[]): ParsedArgs {
  const urls: string[] = [];
  let root: string | undefined;
  let packageJsonPath: string | undefined;
  let usePackageJson = false;
  let token: string | undefined;
  let debug = false;
  let help = false;
  let command: ParsedArgs['command'] = 'generate';
  let autoLogin = true;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === 'generate') {
      continue;
    }

    if (arg === 'login') {
      command = 'login';
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }

    if (arg === '--debug') {
      debug = true;
      continue;
    }

    if (arg === '--no-login') {
      autoLogin = false;
      continue;
    }

    if (arg === '--from-package') {
      usePackageJson = true;
      continue;
    }

    if (arg === '--package') {
      const value = args[i + 1];
      if (!value) {
        throw new Error('ze-types: --package requires a value');
      }
      packageJsonPath = value;
      usePackageJson = true;
      i += 1;
      continue;
    }

    if (arg === '--token') {
      const value = args[i + 1];
      if (!value) {
        throw new Error('ze-types: --token requires a value');
      }
      token = value;
      i += 1;
      continue;
    }

    if (arg === '--url' || arg === '-u') {
      const value = args[i + 1];
      if (!value) {
        throw new Error('ze-types: --url requires a value');
      }
      urls.push(...splitUrls(value));
      i += 1;
      continue;
    }

    if (arg === '--root' || arg === '-r') {
      const value = args[i + 1];
      if (!value) {
        throw new Error('ze-types: --root requires a value');
      }
      root = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`ze-types: unknown option ${arg}`);
    }

    urls.push(...splitUrls(arg));
  }

  if (!urls.length) {
    const envUrls =
      process.env['ZE_TYPES_URLS'] ||
      process.env['ZE_ZEPHYR_URLS'] ||
      process.env['ZE_ZEPHYR_URL'] ||
      '';
    if (envUrls) {
      urls.push(...splitUrls(envUrls));
    }
  }

  if (!token) {
    token = process.env['ZE_TYPES_TOKEN'] || undefined;
  }

  if (!urls.length && !usePackageJson) {
    usePackageJson = true;
  }

  return {
    command,
    urls,
    root,
    packageJsonPath,
    usePackageJson,
    token,
    debug,
    help,
    autoLogin,
  };
}

async function runLogin(root?: string): Promise<void> {
  if (root) {
    process.chdir(root);
  }

  const { checkAuth, getGitInfo } = await import('zephyr-agent');
  const gitInfo = await getGitInfo();
  await checkAuth(gitInfo);
  process.stdout.write('[ze-types] login complete\n');
}

async function main(): Promise<void> {
  try {
    const parsed = parseArgs(process.argv.slice(2));

    if (parsed.help) {
      process.stdout.write(`${HELP}\n`);
      return;
    }

    if (!parsed.urls.length && !parsed.usePackageJson) {
      process.stderr.write(`${HELP}\n`);
      process.exitCode = 1;
      return;
    }

    if (parsed.command === 'login') {
      await runLogin(parsed.root);
      return;
    }

    const result = await generateZeTypes({
      zephyrUrls: parsed.urls,
      projectRoot: parsed.root,
      packageJsonPath: parsed.packageJsonPath,
      usePackageJson: parsed.usePackageJson,
      token: parsed.token,
      autoLogin: parsed.autoLogin && parsed.usePackageJson,
      debug: parsed.debug,
      abortOnError: false,
    });

    const remoteCount = Object.keys(result.remotes).length;
    process.stdout.write(
      `[ze-types] remotes: ${remoteCount}\n[ze-types] output: ${result.typesFolder}\n`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

void main();
