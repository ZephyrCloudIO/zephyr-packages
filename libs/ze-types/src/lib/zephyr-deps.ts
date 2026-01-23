import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  ZE_API_ENDPOINT,
  ze_api_gateway,
  createApplicationUid,
  type ZephyrDependency,
} from 'zephyr-edge-contract';

export interface ZephyrDepsResult {
  remotes: Record<string, string>;
  packageJsonPath: string;
}

export interface ResolveZephyrDepsOptions {
  projectRoot: string;
  packageJsonPath?: string;
  token?: string;
  abortOnError?: boolean;
  debug?: boolean;
}

interface ParsedDependency {
  key: string;
  registry: string;
  appUid: string;
  version: string;
  raw: string;
}

const URL_PREFIXES = ['http://', 'https://', 'file://'];

function logDebug(enabled: boolean, message: string, meta?: unknown) {
  if (!enabled) return;
  if (meta) {
     
    console.log(`[ze-types] ${message}`, meta);
    return;
  }
   
  console.log(`[ze-types] ${message}`);
}

function parseRepoSlug(repoUrl: string): { org: string; project: string } | null {
  const cleaned = repoUrl.replace(/^git\+/, '').replace(/\.git$/, '');

  if (cleaned.startsWith('git@')) {
    const parts = cleaned.split(':');
    if (parts.length < 2) return null;
    const pathPart = parts.slice(1).join(':');
    const segs = pathPart.split('/').filter(Boolean);
    if (segs.length >= 2) {
      return { org: segs[0], project: segs[1] };
    }
    return null;
  }

  try {
    const url = new URL(cleaned);
    const segs = url.pathname.split('/').filter(Boolean);
    if (segs.length >= 2) {
      return { org: segs[0], project: segs[1] };
    }
  } catch {
    // ignore
  }

  return null;
}

function getRepoSlugFromGit(cwd: string): { org: string; project: string } | null {
  try {
    const stdout = execSync('git config --get remote.origin.url', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();

    if (!stdout) return null;
    return parseRepoSlug(stdout);
  } catch {
    return null;
  }
}

function getRepoSlugFromPackageJson(pkg: Record<string, unknown>): {
  org: string;
  project: string;
} | null {
  const repo = pkg.repository;
  const repoUrl =
    typeof repo === 'string'
      ? repo
      : typeof repo === 'object' && repo
        ? (repo as { url?: string }).url
        : undefined;
  if (!repoUrl) return null;
  return parseRepoSlug(repoUrl);
}

function getOrgProject(options: {
  projectRoot: string;
  packageJson: Record<string, unknown>;
}): { org: string; project: string } | null {
  const envOrg = process.env['ZE_APP_ORG'] || process.env['ZE_ORG'];
  const envProject = process.env['ZE_APP_PROJECT'] || process.env['ZE_PROJECT'];
  if (envOrg && envProject) {
    return { org: envOrg, project: envProject };
  }

  const repoFromPkg = getRepoSlugFromPackageJson(options.packageJson);
  if (repoFromPkg) {
    return repoFromPkg;
  }

  return getRepoSlugFromGit(options.projectRoot);
}

function findNearestPackageJson(startPath: string): string {
  let current = path.resolve(startPath);
  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`ze-types: package.json not found from ${startPath}`);
    }
    current = parent;
  }
}

function readPackageJson(packageJsonPath: string): Record<string, unknown> {
  const raw = fs.readFileSync(packageJsonPath, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function parseZeDependency(key: string, value: string): ParsedDependency {
  const dependency: ParsedDependency = {
    key,
    registry: 'zephyr',
    appUid: key,
    version: value,
    raw: value,
  };

  let reference = value;

  if (reference.includes(':') && !reference.includes('workspace:*')) {
    const [registry, ...rest] = reference.split(':');
    dependency.registry = registry;
    reference = rest.join(':');
  }

  if (reference.includes('@')) {
    const parts = reference.split('@');
    dependency.appUid = parts.slice(0, parts.length - 1).join('@');
    dependency.version = parts[parts.length - 1];
  } else {
    dependency.version = reference;
  }

  return dependency;
}

function isUrlLike(value: string): boolean {
  if (URL_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return true;
  }
  return value.startsWith('//');
}

function normalizeRemoteUrl(value: string): string {
  if (value.startsWith('//')) {
    return `https:${value}`;
  }
  return value;
}

function normalizeVersion(value: string): string {
  if (value.startsWith('workspace:')) {
    return '*';
  }
  return value;
}

function resolveApplicationUid(options: {
  key: string;
  appUid: string;
  orgProject: { org: string; project: string } | null;
}): string {
  const directUid = [options.appUid, options.key].find((candidate) => {
    return candidate.split('.').length >= 3;
  });

  if (directUid) {
    return directUid;
  }

  if (!options.orgProject) {
    throw new Error(
      'ze-types: missing org/project for zephyr:dependencies; set ZE_APP_ORG/ZE_APP_PROJECT or provide full app uid'
    );
  }

  const name = options.appUid || options.key;
  return createApplicationUid({
    org: options.orgProject.org,
    project: options.orgProject.project,
    name,
  });
}

async function resolveAuthToken(options: {
  token?: string;
}): Promise<string | undefined> {
  if (options.token) {
    return options.token;
  }
  const envToken =
    process.env['ZE_SECRET_TOKEN'] ||
    process.env['ZE_AUTH_TOKEN'] ||
    process.env['ZE_TOKEN'];
  if (envToken) {
    return envToken;
  }

  const serverToken = process.env['ZE_SERVER_TOKEN'];
  if (!serverToken) {
    return undefined;
  }

  const email =
    process.env['ZE_USER_EMAIL'] ||
    process.env['GIT_AUTHOR_EMAIL'] ||
    process.env['GIT_COMMITTER_EMAIL'];
  if (!email) {
    return undefined;
  }

  const exchangeUrl = new URL(
    ze_api_gateway.get_access_token_by_server_token,
    ZE_API_ENDPOINT()
  );
  exchangeUrl.searchParams.set('email', email);

  const response = await fetch(exchangeUrl.toString(), {
    headers: {
      Authorization: `Bearer ${serverToken}`,
    },
  });

  if (!response.ok) {
    return undefined;
  }

  const data = (await response.json()) as { access_token?: string };
  return data.access_token;
}

async function resolveRemoteDependency(options: {
  applicationUid: string;
  version: string;
  token?: string;
}): Promise<ZephyrDependency> {
  const endpoint = new URL(
    `${ze_api_gateway.resolve}/${encodeURIComponent(options.applicationUid)}/${encodeURIComponent(options.version)}`,
    ZE_API_ENDPOINT()
  );

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(endpoint.toString(), { headers });
  if (!response.ok) {
    throw new Error(
      `ze-types: failed to resolve ${options.applicationUid}@${options.version} (${response.status} ${response.statusText})`
    );
  }

  const data = (await response.json()) as { value?: ZephyrDependency };
  if (!data.value) {
    throw new Error(`ze-types: invalid resolve response for ${options.applicationUid}`);
  }

  return data.value;
}

export async function resolveZephyrDependencies(
  options: ResolveZephyrDepsOptions
): Promise<ZephyrDepsResult> {
  const packageJsonPath = options.packageJsonPath
    ? path.resolve(options.packageJsonPath)
    : findNearestPackageJson(options.projectRoot);

  const packageJson = readPackageJson(packageJsonPath);
  const zephyrDepsRaw =
    (packageJson['zephyr:dependencies'] as Record<string, string> | undefined) ||
    (packageJson['zephyrDependencies'] as Record<string, string> | undefined);

  if (!zephyrDepsRaw || Object.keys(zephyrDepsRaw).length === 0) {
    throw new Error(`ze-types: no zephyr:dependencies found in ${packageJsonPath}`);
  }

  const orgProject = getOrgProject({ projectRoot: options.projectRoot, packageJson });
  const token = await resolveAuthToken({ token: options.token });

  const remotes: Record<string, string> = {};
  const entries = Object.entries(zephyrDepsRaw);

  for (const [key, value] of entries) {
    const parsed = parseZeDependency(key, value);

    if (parsed.registry !== 'zephyr') {
      logDebug(options.debug ?? false, `skipping non-zephyr dependency: ${key}`);
      continue;
    }

    if (isUrlLike(parsed.version)) {
      remotes[key] = normalizeRemoteUrl(parsed.version);
      continue;
    }

    const applicationUid = resolveApplicationUid({
      key,
      appUid: parsed.appUid,
      orgProject,
    });
    const version = normalizeVersion(parsed.version);

    if (!token) {
      throw new Error(
        'ze-types: missing auth token. Set ZE_SECRET_TOKEN or ZE_AUTH_TOKEN to resolve zephyr:dependencies.'
      );
    }

    try {
      const resolved = await resolveRemoteDependency({
        applicationUid,
        version,
        token,
      });
      const remoteUrl = resolved.remote_entry_url || resolved.default_url;
      if (!remoteUrl) {
        throw new Error(`ze-types: resolve missing remote url for ${key}`);
      }
      remotes[key] = normalizeRemoteUrl(remoteUrl);
    } catch (error) {
      if (options.abortOnError === false) {
        logDebug(options.debug ?? false, `failed to resolve ${key}`, error);
        continue;
      }
      throw error;
    }
  }

  return { remotes, packageJsonPath };
}
