import { ZeErrors, ZephyrError } from '../errors';

interface ParsedGitUrl {
  resource: string;
  owner: string;
  name: string;
  pathname: string;
}

// Standard Git provider domains mapping
const STANDARD_DOMAINS: Record<string, string> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'bitbucket.org': 'bitbucket',
  'dev.azure.com': 'azure',
  'ssh.dev.azure.com': 'azure',
  'vs-ssh.visualstudio.com': 'azure',
};

/**
 * Git provider detection and information extraction. In Zephyr, application_uid is
 * created as: [app_name, git_repo, git_org].join('.') where app_name comes from
 * package.json name field, not from the git URL.
 */
export function getGitProviderInfo(gitUrl: string): {
  provider: string;
  owner: string;
  project: string;
  isEnterprise: boolean;
} {
  if (!gitUrl) {
    throw new ZephyrError(ZeErrors.ERR_GIT_REMOTE_ORIGIN);
  }

  const parsed = parseGitUrl(gitUrl);
  const resource = parsed.resource.toLowerCase();

  // Determine provider type and enterprise status from resource domain
  const provider = detectProvider(parsed, resource);
  const isEnterprise = provider === 'custom';

  // Extract owner based on provider and enterprise status
  const owner = isEnterprise
    ? extractEnterpriseOwner(parsed)
    : extractStandardOwner(parsed, provider);

  // Extract project name
  const project = extractProjectName(parsed, provider, isEnterprise);

  return { provider, owner, project, isEnterprise };
}

function parseGitUrl(gitUrl: string): ParsedGitUrl {
  let resource: string;
  let pathname: string;

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(gitUrl)) {
    try {
      const url = new URL(gitUrl);
      resource = url.hostname;
      pathname = url.pathname;
    } catch {
      throw new ZephyrError(ZeErrors.ERR_GIT_REMOTE_ORIGIN);
    }
  } else {
    const scpRemote = /^(?:[^@/:]+@)?([^/:]+):(.+)$/.exec(gitUrl);
    if (!scpRemote) {
      throw new ZephyrError(ZeErrors.ERR_GIT_REMOTE_ORIGIN);
    }
    resource = scpRemote[1];
    pathname = scpRemote[2];
  }

  const pathParts = pathname.split('/').filter(Boolean);
  const name = pathParts.at(-1)?.replace(/\.git$/, '') ?? '';
  if (!resource || !name) {
    throw new ZephyrError(ZeErrors.ERR_GIT_REMOTE_ORIGIN);
  }

  return {
    resource,
    owner: pathParts.slice(0, -1).join('/'),
    name,
    pathname,
  };
}

function detectProvider(parsed: ParsedGitUrl, resource: string): string {
  const standardProvider = STANDARD_DOMAINS[resource];
  if (standardProvider) {
    return standardProvider;
  }

  if (resource.endsWith('.visualstudio.com')) {
    return 'azure';
  }

  const pathParts = getPathParts(parsed);
  if (pathParts[0] === 'v3' && pathParts.length >= 4) {
    return 'azure';
  }

  return 'custom';
}

/** Extracts organization name from enterprise domain */
function extractEnterpriseOwner(parsed: ParsedGitUrl): string {
  const domainParts = parsed.resource.split('.');

  // For domains like gitlab.company.com, use company.com as the base
  const baseDomain =
    domainParts.length > 2 ? domainParts.slice(1).join('.') : parsed.resource;

  // Replace dots with hyphens
  return baseDomain.replace(/\./g, '-').toLowerCase();
}

/** Extracts owner from standard domain providers with special handling */
function extractStandardOwner(parsed: ParsedGitUrl, provider: string): string {
  if (provider === 'azure') {
    return extractAzureOrganization(parsed);
  }

  const rawOwner = parsed.owner.toLowerCase();

  // For GitLab and Bitbucket with subgroups, extract just the first part as the owner
  if ((provider === 'gitlab' || provider === 'bitbucket') && rawOwner.includes('/')) {
    return rawOwner.split('/')[0];
  }

  return rawOwner;
}

/** Extracts project name based on provider and URL structure */
function extractProjectName(
  parsed: ParsedGitUrl,
  provider: string,
  isEnterprise: boolean
): string {
  if (provider === 'azure') {
    return extractAzureRepoName(parsed);
  }

  // Special handling for self-hosted GitLab with deep subgroups
  if (isEnterprise && provider === 'gitlab' && parsed.pathname) {
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    // For deep subgroup paths in self-hosted GitLab, use the last part
    if (pathParts.length > 2) {
      return pathParts[pathParts.length - 1].replace('.git', '').toLowerCase();
    }
  }

  // For all other cases, use the name property directly
  return parsed.name.toLowerCase();
}

function extractAzureOrganization(parsed: ParsedGitUrl): string {
  const pathParts = getPathParts(parsed);
  if (pathParts[0] === 'v3' && pathParts[1]) {
    return pathParts[1].toLowerCase();
  }

  const resource = parsed.resource.toLowerCase();
  if (resource.endsWith('.visualstudio.com')) {
    return resource.replace(/\.visualstudio\.com$/, '').toLowerCase();
  }

  const organization = pathParts[0];

  return (organization || parsed.owner).toLowerCase();
}

function extractAzureRepoName(parsed: ParsedGitUrl): string {
  const pathParts = getPathParts(parsed);
  const gitSegmentIndex = pathParts.findIndex((part) => part.toLowerCase() === '_git');
  const repoName =
    gitSegmentIndex >= 0
      ? pathParts[gitSegmentIndex + 1]
      : pathParts[pathParts.length - 1];

  return sanitizeGitName(repoName || parsed.name);
}

function getPathParts(parsed: ParsedGitUrl): string[] {
  return parsed.pathname.split('/').filter(Boolean);
}

function sanitizeGitName(name: string): string {
  try {
    return decodeURIComponent(name)
      .replace(/\.git$/, '')
      .toLowerCase();
  } catch {
    return name.replace(/\.git$/, '').toLowerCase();
  }
}
