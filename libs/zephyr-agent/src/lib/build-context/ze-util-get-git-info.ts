import isCI from 'is-ci';
import { execFile as node_execFile } from 'node:child_process';
import { sep } from 'node:path';
import { promisify } from 'node:util';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { ZE_API_ENDPOINT } from 'zephyr-edge-contract';
import { isTokenStillValid } from '../auth/login';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import { logFn } from '../logging/ze-log-event';
import { hasSecretToken } from '../node-persist/secret-token';
import { getToken } from '../node-persist/token';
import { detectCIBranch } from './ci-branch-detection';
import { getGitProviderInfo } from './git-provider-utils';
import { detectMonorepo, getMonorepoRootPackageJson } from './detect-monorepo';
import { getPackageJson } from './ze-util-read-package-json';
import {
  getZephyrConfig,
  resolveZephyrContextDirectory,
  type ResolvedZephyrConfig,
} from './zephyr-config';

const execFile = promisify(node_execFile);

/**
 * Runs a single git subcommand without a shell.
 *
 * Using `execFile` (instead of a shell `exec` with chained `&&`/`||` operators) avoids
 * cross-platform shell parsing bugs. Windows spawns `cmd.exe`, which parses operator
 * precedence and quoting differently than the POSIX `sh` used on Linux/macOS, and
 * previously left the commit slot empty in CI.
 *
 * Returns the trimmed stdout, or `null` when the command exits non-zero or produces no
 * output.
 */
async function runGit(args: string[], context: string): Promise<string | null> {
  try {
    const { stdout } = await execFile('git', args, { cwd: context });
    const trimmed = stdout.trim();
    return trimmed === '' ? null : trimmed;
  } catch {
    return null;
  }
}

export interface ZeGitInfo {
  app: Pick<ZephyrPluginOptions['app'], 'org' | 'project'>;
  git: ZephyrPluginOptions['git'];
}

interface UserInfo {
  name: string;
  email: string;
  id: string;
}

/** Generate branch name for non-git contexts */
function generateBranchName(context: 'global-git' | 'no-git', userId?: string): string {
  const timestamp = new Date().toISOString().replace(/\D/g, '');
  const userSuffix = userId ? `-${userId.slice(0, 8)}` : '';
  return `${context}${userSuffix}-${timestamp}`;
}

/** Loads Git information and application identity from the supplied project context. */
export async function getGitInfo(
  context?: string,
  zephyrConfig: ResolvedZephyrConfig = getZephyrConfig(context)
): Promise<ZeGitInfo> {
  // Always gather fresh git info for build accuracy
  return await gatherGitInfo(resolveZephyrContextDirectory(context), zephyrConfig);
}

/** Internal function that actually gathers git information. */
async function gatherGitInfo(
  context: string,
  zephyrConfig: ResolvedZephyrConfig
): Promise<ZeGitInfo> {
  const hasToken = hasSecretToken();

  try {
    const { name, email, remoteOrigin, branch, commit, tags, stdout } = await loadGitInfo(
      hasToken,
      context
    );

    if (!hasToken && (!name || !email)) {
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_USERNAME_EMAIL, {
        data: { stdout },
      });
    }

    const app = resolveApplicationIdentity(remoteOrigin, stdout, zephyrConfig);

    const gitInfo = {
      git: { name, email, branch, commit, tags },
      app,
    };

    ze_log.git('Loaded: git info', gitInfo);

    return gitInfo;
  } catch (error) {
    // Explicit identity can replace a missing origin, but it cannot invent stable build
    // history. Never fall through to timestamp/global-user metadata in CI.
    if (isCI) {
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message:
          'Stable Git branch and commit information is required in CI environments',
        cause: error,
      });
    }

    if (!hasConfiguredApp(zephyrConfig)) {
      // If git repo info is not available, try global git config
      logFn(
        'warn',
        'Git repository not found. Zephyr REQUIRES a git repository with remote origin.'
      );
      logFn(
        'warn',
        'Manual configuration is NOT recommended and WILL cause errors in production.'
      );
      logFn('warn', '');
      logFn('warn', 'To properly use Zephyr, you MUST:');
      logFn('warn', '1. Initialize git: git init');
      logFn('warn', '2. Add remote: git remote add origin git@github.com:ORG/REPO.git');
      logFn(
        'warn',
        '3. For CI/production reliability, add at least one commit: git add . && git commit -m "Initial commit"'
      );
      logFn('warn', '');
      logFn(
        'warn',
        'Alternative: Use our CLI for automatic setup: npx create-zephyr-apps'
      );
      logFn('warn', '📝 Documentation: https://docs.zephyr-cloud.io');
    }
    ze_log.git('Git repository not found, falling back to global git config');

    try {
      const globalGitInfo = await loadGlobalGitInfo(context, zephyrConfig);
      return globalGitInfo;
    } catch {
      // If global git config also fails, use defaults
      logFn('warn', 'Global git config not found, using auto-generated defaults');
      ze_log.git('Global git config not found, using auto-generated defaults');

      const fallbackInfo = await getFallbackGitInfo(context, zephyrConfig);
      return fallbackInfo;
    }
  }
}

const NO_GIT_COMMIT = 'no-git-commit';

/**
 * Loads git metadata by running each subcommand separately via `execFile`.
 *
 * Previously all reads were joined into a single shell command using `&&`/`||` operators
 * and a delimiter. That relied on shell operator precedence and quoting, which `cmd.exe`
 * (Windows) parses differently than POSIX `sh`, causing the commit hash to be dropped in
 * Windows CI. Running each command without a shell removes that entire class of
 * cross-platform bugs.
 */
async function loadGitInfo(
  hasSecretToken: boolean,
  context: string
): Promise<{
  name: string;
  email: string;
  remoteOrigin: string;
  branch: string;
  commit: string;
  tags: string[];
  stdout: string;
}> {
  const automated = isCI || hasSecretToken;

  const [name, email, remoteOrigin, gitBranch, rawCommit, tags] = await Promise.all([
    // Inside CI environments, the last committer should be the actor
    // and not the actual logged git user which sometimes might just be a bot
    automated
      ? runGit(['log', '-1', '--pretty=format:%an'], context)
      : runGit(['config', 'user.name'], context),
    automated
      ? runGit(['log', '-1', '--pretty=format:%ae'], context)
      : runGit(['config', 'user.email'], context),
    // A complete explicit identity does not need an origin; a missing origin is
    // tolerated and normalized to an empty string below.
    runGit(['config', '--get', 'remote.origin.url'], context),
    // Handles unborn branches in fresh repositories
    loadGitBranch(context),
    // No commits yet should not block local build metadata extraction
    runGit(['rev-parse', 'HEAD'], context),
    loadGitTags(context),
  ]);

  // A completely unavailable git repository surfaces as null for the core
  // reads; mirror the previous "not a git repository" failure so callers fall
  // back to global/API metadata (or fail closed in CI).
  if (name === null && email === null && gitBranch === null && rawCommit === null) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message: 'Not a git repository',
      data: { context },
    });
  }

  const commit = rawCommit ?? NO_GIT_COMMIT;

  // Synthesize a combined stdout for diagnostics/downstream error messages that
  // still expect a single blob to inspect.
  const stdout = [name, email, remoteOrigin, gitBranch, commit].join('\n');

  // In CI environments with detached HEAD, git returns "HEAD" as branch name.
  // Try to get branch from CI environment variables first.
  let branch = gitBranch;
  if (isCI && (gitBranch === 'HEAD' || !gitBranch)) {
    const ciInfo = detectCIBranch();
    if (ciInfo.branch) {
      branch = ciInfo.branch;
      ze_log.git(
        `Detected branch from ${ciInfo.platform} environment variables: ${branch}`,
        {
          platform: ciInfo.platform,
          branch,
          isPR: ciInfo.isPR,
          gitBranch,
        }
      );
    } else {
      ze_log.git(
        `Branch detection in CI failed. Git returned: "${gitBranch}", no CI env vars available`,
        { platform: ciInfo.platform, gitBranch }
      );
    }
  }

  if (isCI && (!branch || branch === 'HEAD')) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message:
        'Git branch is required in CI environments. Configure the CI provider branch variables or check out a named branch.',
    });
  }

  if (isCI && (!commit || commit === NO_GIT_COMMIT)) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message:
        'Git commit hash is required in CI environments. Ensure this repository has commit history.',
    });
  }

  return {
    name: name ?? '',
    email: email ?? '',
    remoteOrigin: remoteOrigin ?? '',
    branch: branch ?? '',
    commit,
    tags,
    stdout,
  };
}

/** Resolve the current branch, handling unborn branches in fresh repositories. */
async function loadGitBranch(context: string): Promise<string | null> {
  const symbolic = await runGit(['symbolic-ref', '--short', 'HEAD'], context);
  if (symbolic) {
    return symbolic;
  }
  return runGit(['rev-parse', '--abbrev-ref', 'HEAD'], context);
}

/** Load tags pointing at HEAD. Missing commits/no tags should not fail local flow. */
async function loadGitTags(context: string): Promise<string[]> {
  const stdout = await runGit(['tag', '--points-at', 'HEAD'], context);
  return stdout ? stdout.split('\n').filter(Boolean) : [];
}

function hasConfiguredApp(
  config: ResolvedZephyrConfig
): config is ResolvedZephyrConfig & { org: string; project: string } {
  return Boolean(config.org && config.project);
}

function resolveApplicationIdentity(
  remoteOrigin: string,
  stdout: string,
  config: ResolvedZephyrConfig
): ZeGitInfo['app'] {
  if (hasConfiguredApp(config)) {
    return { org: config.org, project: config.project };
  }

  const inferred = parseGitUrl(remoteOrigin, stdout);
  return {
    org: config.org ?? inferred.org,
    project: config.project ?? inferred.project,
  };
}

function applyConfiguredApp(
  app: ZeGitInfo['app'],
  config: ResolvedZephyrConfig
): ZeGitInfo['app'] {
  return {
    org: config.org ?? app.org,
    project: config.project ?? app.project,
  };
}

/**
 * Parses the git url using the `git-url-parse` package.
 *
 * This package differentiates CI providers and handles git info from various platforms
 * like GitHub, GitLab, Bitbucket, and custom git deployments.
 */
function parseGitUrl(
  remoteOrigin: string,
  stdout: string
): Pick<ZephyrPluginOptions['app'], 'org' | 'project'> {
  if (!remoteOrigin) {
    throw new ZephyrError(ZeErrors.ERR_GIT_REMOTE_ORIGIN, {
      data: { stdout },
    });
  }

  try {
    const gitInfo = getGitProviderInfo(remoteOrigin);

    ze_log.git(`Git provider detected: ${gitInfo.provider}`, {
      provider: gitInfo.provider,
      owner: gitInfo.owner,
      project: gitInfo.project,
      isEnterprise: gitInfo.isEnterprise,
    });

    return {
      org: gitInfo.owner,
      project: gitInfo.project,
    };
  } catch (cause) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message: stdout,
      cause,
      data: { stdout },
    });
  }
}

/** Try to load git info from global git config */
async function loadGlobalGitInfo(
  context: string,
  zephyrConfig: ResolvedZephyrConfig
): Promise<ZeGitInfo> {
  try {
    const [globalName, globalEmail] = await Promise.all([
      runGit(['config', '--global', 'user.name'], context),
      runGit(['config', '--global', 'user.email'], context),
    ]);

    const name = globalName ?? '';
    const email = globalEmail ?? '';

    if (!name && !email) {
      logFn(
        'warn',
        'Global git config incomplete: both name and email are missing. Falling back to API user info.'
      );
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message: 'Global git config incomplete: both name and email are missing',
      });
    }

    if (!name) {
      logFn(
        'warn',
        'Global git config incomplete: user name is missing. Run: git config --global user.name "Your Name". Falling back to API user info.'
      );
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message: 'Global git config incomplete: user name is missing',
      });
    }

    if (!email) {
      logFn(
        'warn',
        'Global git config incomplete: user email is missing. Run: git config --global user.email "your@email.com". Falling back to API user info.'
      );
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message: 'Global git config incomplete: user email is missing',
      });
    }

    const app = hasConfiguredApp(zephyrConfig)
      ? { org: zephyrConfig.org, project: zephyrConfig.project }
      : applyConfiguredApp(
          await getAppNamingFromPackageJson(name, context, zephyrConfig),
          zephyrConfig
        );

    const gitInfo: ZeGitInfo = {
      git: {
        name,
        email,
        branch: generateBranchName('global-git'),
        commit: NO_GIT_COMMIT,
        tags: [],
      },
      app,
    };

    ze_log.git('Using global git config (no local repository)', gitInfo);

    if (!hasConfiguredApp(zephyrConfig)) {
      logFn('warn', 'Configuration accepted for THIS BUILD ONLY.');
      logFn(
        'warn',
        'This manual configuration will NOT work for production deployments.'
      );
      logFn(
        'warn',
        'Zephyr REQUIRES a proper git repository with remote origin to function correctly.'
      );
      logFn(
        'warn',
        'Please set up git before your next deployment: https://docs.zephyr-cloud.io'
      );
    }

    return gitInfo;
  } catch (error) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message: 'Failed to load global git config',
      cause: error,
    });
  }
}

/** Get user info from API endpoint instead of JWT decoding */
async function getUserInfoFromAPI(): Promise<UserInfo> {
  const token = await getToken();
  if (!token || !isTokenStillValid(token, 60)) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message: 'No valid authentication token found. Please login first.',
    });
  }

  const [ok, cause, response] = await makeRequest<{ value: UserInfo }>({
    path: '/v2/user/me',
    base: ZE_API_ENDPOINT(),
    query: {},
  });

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message:
        'Failed to get user information from API. Please ensure you are logged in with a valid token.',
      cause,
    });
  }

  const userData = response.value;

  ze_log.git('Retrieved user info from API:', {
    name: userData.name,
    email: userData.email,
  });

  return userData;
}

/** Generate fallback git info when git is completely unavailable */
async function getFallbackGitInfo(
  context: string,
  zephyrConfig: ResolvedZephyrConfig
): Promise<ZeGitInfo> {
  let userInfo: UserInfo;

  try {
    userInfo = await getUserInfoFromAPI();
  } catch (error) {
    ze_log.git('Failed to get user info from API:', error);
    throw error;
  }

  const gitName = userInfo.name;
  const gitEmail = userInfo.email;

  if (isCI && !hasConfiguredApp(zephyrConfig)) {
    throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
      message:
        'Git repository information is required in CI environments. Please ensure your CI workflow includes git repository with proper remote origin.',
    });
  }

  const app = hasConfiguredApp(zephyrConfig)
    ? { org: zephyrConfig.org, project: zephyrConfig.project }
    : applyConfiguredApp(
        await getAppNamingFromPackageJson(userInfo.name, context, zephyrConfig),
        zephyrConfig
      );

  const gitInfo: ZeGitInfo = {
    git: {
      name: gitName,
      email: gitEmail,
      branch: generateBranchName('no-git', userInfo.id),
      commit: `fallback-deployment-${Date.now()}`,
      tags: [`deployed-by:${userInfo.id}`],
    },
    app,
  };

  ze_log.git('Using fallback git info (git not available)', gitInfo);

  if (!hasConfiguredApp(zephyrConfig)) {
    logFn('warn', `Using organization "${app.org}" from authenticated user.`);
    logFn('warn', 'Configuration accepted for THIS BUILD ONLY.');
    logFn('warn', 'This manual configuration will NOT work for production deployments.');
    logFn(
      'warn',
      'Zephyr REQUIRES a proper git repository with remote origin to function correctly.'
    );
    logFn(
      'warn',
      'Please set up git before your next deployment: https://docs.zephyr-cloud.io'
    );
  }

  return gitInfo;
}

/** Sanitize string for use as org/project name */
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

/** Get the supplied context directory name as project name. */
function getCurrentDirectoryName(context: string): string {
  const dirName = context.split(sep).pop() || 'untitled-project';
  return sanitizeName(dirName);
}

/**
 * Extract org, project, and app names from package.json structure for non-git
 * environments
 */
async function getAppNamingFromPackageJson(
  tokenUserName: string | undefined,
  context: string,
  zephyrConfig: ResolvedZephyrConfig
): Promise<{ org: string; project: string; app: string }> {
  try {
    const packageJson = await getPackageJson(context, zephyrConfig);
    const packageName = packageJson.name;

    // Require JWT username for org - no fallback to avoid build loss
    if (!tokenUserName) {
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message:
          'Unable to determine organization: no authenticated user found. Please ensure you are logged in with a valid token.',
      });
    }
    const org = sanitizeName(tokenUserName);

    if (packageName.includes('@')) {
      // Scoped package: @scope/name -> project: scope, app: name
      const [scope, name] = packageName.split('/');
      return {
        org,
        project: scope.replace('@', ''),
        app: name,
      };
    }

    // Check if we're in a monorepo
    const monorepoInfo = await detectMonorepo(context);

    if (monorepoInfo.type !== 'none') {
      // We're in a monorepo
      const rootPackageJson = await getMonorepoRootPackageJson(monorepoInfo.root);

      if (rootPackageJson && rootPackageJson['name']) {
        const rootName = rootPackageJson['name'] as string;
        // If root package is scoped, use the scope as project
        if (rootName.includes('@')) {
          const [scope] = rootName.split('/');
          return {
            org,
            project: scope.replace('@', ''),
            app: packageName,
          };
        }
        // Use root package name as project
        return {
          org,
          project: sanitizeName(rootName),
          app: packageName,
        };
      } else {
        // No root package.json or no name - use monorepo root directory name
        const rootDirName = monorepoInfo.root.split(sep).pop() || 'monorepo';
        return {
          org,
          project: sanitizeName(rootDirName),
          app: packageName,
        };
      }
    }

    // Not in a monorepo - single package
    return {
      org,
      project: packageName,
      app: packageName,
    };
  } catch {
    // No package.json: use directory name
    const dirName = getCurrentDirectoryName(context);
    if (!tokenUserName) {
      throw new ZephyrError(ZeErrors.ERR_NO_GIT_INFO, {
        message:
          'Unable to determine organization: no authenticated user found and no package.json available. Please ensure you are logged in with a valid token.',
      });
    }
    return {
      org: sanitizeName(tokenUserName),
      project: dirName,
      app: dirName,
    };
  }
}
