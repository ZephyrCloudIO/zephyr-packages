import gitUrlParse from 'git-url-parse';

// Standard Git provider domains mapping
const STANDARD_DOMAINS: Record<string, string> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'bitbucket.org': 'bitbucket',
};

const STANDARD_DOMAIN_NAMES = Object.keys(STANDARD_DOMAINS);

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
    throw new Error('Git URL is required');
  }

  const parsed = gitUrlParse(gitUrl);

  // Detect if this is an enterprise/self-hosted instance
  const isEnterprise = !STANDARD_DOMAIN_NAMES.includes(parsed.resource);

  // Determine provider type by checking various URL parts
  const provider = determineProvider(parsed);

  // Extract owner based on provider and enterprise status
  const owner = isEnterprise
    ? extractEnterpriseOwner(parsed)
    : extractStandardOwner(parsed, provider);

  // Extract project name based on provider and URL structure
  const project = extractProjectName(parsed, provider, isEnterprise);

  return { provider, owner, project, isEnterprise };
}

/** Determines the Git provider based on URL analysis */
function determineProvider(parsed: gitUrlParse.GitUrl): string {
  const hostname = parsed.resource.toLowerCase();

  // Check if it's a standard domain
  if (STANDARD_DOMAINS[hostname]) {
    return STANDARD_DOMAINS[hostname];
  }

  // All other domains are treated as custom
  return 'custom';
}

/** Extracts organization name from enterprise domain */
function extractEnterpriseOwner(parsed: gitUrlParse.GitUrl): string {
  const domainParts = parsed.resource.split('.');

  // For domains like gitlab.company.com, use company.com as the base
  const baseDomain =
    domainParts.length > 2 ? domainParts.slice(1).join('.') : parsed.resource;

  // Replace dots with hyphens
  return baseDomain.replace(/\./g, '-').toLowerCase();
}

/** Extracts owner from standard domain providers with special handling */
function extractStandardOwner(parsed: gitUrlParse.GitUrl, provider: string): string {
  const rawOwner = parsed.owner.toLowerCase();

  // For GitLab and Bitbucket with subgroups, extract just the first part as the owner
  if ((provider === 'gitlab' || provider === 'bitbucket') && rawOwner.includes('/')) {
    return rawOwner.split('/')[0];
  }

  return rawOwner;
}

/** Extracts project name based on provider and URL structure */
function extractProjectName(
  parsed: gitUrlParse.GitUrl,
  provider: string,
  isEnterprise: boolean
): string {
  const project = parsed.name.toLowerCase();

  // Special handling for self-hosted GitLab with deep subgroups
  if (isEnterprise && provider === 'gitlab' && parsed.pathname) {
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    // For deep subgroup paths in self-hosted GitLab, use the last part
    if (pathParts.length > 2) {
      return pathParts[pathParts.length - 1].replace('.git', '').toLowerCase();
    }
  }

  return project;
}
