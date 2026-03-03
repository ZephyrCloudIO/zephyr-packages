/**
 * CI/CD Branch Detection Utility
 *
 * Detects branch names from CI/CD environment variables across major platforms. Used to
 * handle detached HEAD state in CI environments where git commands fail.
 */

export interface CIBranchInfo {
  /** The detected CI platform name */
  platform: string;
  /** Whether running in a CI environment */
  isCI: boolean;
  /** The branch name extracted from CI environment variables */
  branch: string | undefined;
  /** Whether this is a pull/merge request build */
  isPR: boolean;
  /** Source branch for PRs (the branch being merged from) */
  sourceBranch?: string;
  /** Target branch for PRs (the branch being merged into) */
  targetBranch?: string;
  /** Tag name if this is a tag build */
  tag?: string;
}

/**
 * Detects the current CI environment and extracts branch information. Supports: GitHub
 * Actions, GitLab CI, Jenkins, Bitbucket, CircleCI, Travis CI, Azure Pipelines, TeamCity,
 * Drone CI, Buildkite
 */
export function detectCIBranch(): CIBranchInfo {
  const env = process.env;

  // GitHub Actions
  if (env['GITHUB_ACTIONS'] === 'true' || env['GITHUB_WORKFLOW']) {
    const isPR = !!env['GITHUB_HEAD_REF'];
    return {
      platform: 'GitHub Actions',
      isCI: true,
      branch:
        env['GITHUB_HEAD_REF'] ||
        env['GITHUB_REF_NAME'] ||
        extractBranchFromRef(env['GITHUB_REF']),
      isPR,
      sourceBranch: env['GITHUB_HEAD_REF'],
      targetBranch: env['GITHUB_BASE_REF'],
      tag: env['GITHUB_REF']?.startsWith('refs/tags/')
        ? env['GITHUB_REF_NAME']
        : undefined,
    };
  }

  // GitLab CI
  if (env['GITLAB_CI'] === 'true' || env['CI_SERVER_NAME'] === 'GitLab') {
    const isPR = !!env['CI_MERGE_REQUEST_ID'];
    return {
      platform: 'GitLab CI',
      isCI: true,
      branch:
        env['CI_MERGE_REQUEST_SOURCE_BRANCH_NAME'] ||
        env['CI_COMMIT_BRANCH'] ||
        env['CI_COMMIT_REF_NAME'],
      isPR,
      sourceBranch: env['CI_MERGE_REQUEST_SOURCE_BRANCH_NAME'],
      targetBranch: env['CI_MERGE_REQUEST_TARGET_BRANCH_NAME'],
      tag: !env['CI_COMMIT_BRANCH'] ? env['CI_COMMIT_REF_NAME'] : undefined,
    };
  }

  // Jenkins
  if (env['JENKINS_URL'] || env['JENKINS_HOME']) {
    const isPR = !!env['CHANGE_ID'];
    const gitBranch = env['GIT_BRANCH']?.replace(/^origin\//, '');
    return {
      platform: 'Jenkins',
      isCI: true,
      branch:
        env['CHANGE_BRANCH'] ||
        env['BRANCH_NAME'] ||
        gitBranch ||
        env['GIT_LOCAL_BRANCH'],
      isPR,
      sourceBranch: env['CHANGE_BRANCH'],
      targetBranch: env['CHANGE_TARGET'],
    };
  }

  // Bitbucket Pipelines
  if (env['BITBUCKET_BUILD_NUMBER'] || env['BITBUCKET_COMMIT']) {
    const isPR = !!env['BITBUCKET_PR_ID'];
    return {
      platform: 'Bitbucket Pipelines',
      isCI: true,
      branch: env['BITBUCKET_BRANCH'] || env['BITBUCKET_TAG'],
      isPR,
      targetBranch: env['BITBUCKET_PR_DESTINATION_BRANCH'],
      tag: env['BITBUCKET_TAG'],
    };
  }

  // CircleCI
  if (env['CIRCLECI'] === 'true' || env['CIRCLE_BUILD_NUM']) {
    // Note: CIRCLE_PULL_REQUEST not available with GitHub Apps integration
    // CIRCLE_PR_NUMBER available for forked PRs, CIRCLE_PULL_REQUESTS is comma-separated list
    const isPR = !!(
      env['CIRCLE_PULL_REQUEST'] ||
      env['CIRCLE_PR_NUMBER'] ||
      env['CIRCLE_PULL_REQUESTS']
    );
    return {
      platform: 'CircleCI',
      isCI: true,
      branch: env['CIRCLE_BRANCH'] || env['CIRCLE_TAG'],
      isPR,
      tag: env['CIRCLE_TAG'],
    };
  }

  // Travis CI
  if (env['TRAVIS'] === 'true' || (env['CI'] === 'true' && env['TRAVIS_BUILD_ID'])) {
    const isPR = env['TRAVIS_PULL_REQUEST'] !== 'false';
    return {
      platform: 'Travis CI',
      isCI: true,
      branch:
        env['TRAVIS_PULL_REQUEST_BRANCH'] || env['TRAVIS_BRANCH'] || env['TRAVIS_TAG'],
      isPR,
      sourceBranch: env['TRAVIS_PULL_REQUEST_BRANCH'],
      targetBranch: env['TRAVIS_PULL_REQUEST_BRANCH'] ? env['TRAVIS_BRANCH'] : undefined,
      tag: env['TRAVIS_TAG'],
    };
  }

  // Azure Pipelines
  // Note: TF_BUILD is the official detection variable; AZURE_PIPELINES is not documented
  if (env['TF_BUILD'] === 'True') {
    const isPR = !!env['SYSTEM_PULLREQUEST_PULLREQUESTID'];
    const prSourceBranch = extractBranchFromRef(env['SYSTEM_PULLREQUEST_SOURCEBRANCH']);
    const regularBranch =
      env['BUILD_SOURCEBRANCHNAME'] !== 'merge'
        ? env['BUILD_SOURCEBRANCHNAME']
        : extractBranchFromRef(env['BUILD_SOURCEBRANCH']);

    return {
      platform: 'Azure Pipelines',
      isCI: true,
      branch: prSourceBranch || regularBranch,
      isPR,
      sourceBranch: prSourceBranch,
      targetBranch: extractBranchFromRef(env['SYSTEM_PULLREQUEST_TARGETBRANCH']),
    };
  }

  // TeamCity
  if (env['TEAMCITY_VERSION']) {
    // TeamCity requires custom environment variable setup
    // Users need to set env.GIT_BRANCH from teamcity.build.vcs.branch
    const branch = env['GIT_BRANCH'] || env['BRANCH_NAME'];
    return {
      platform: 'TeamCity',
      isCI: true,
      branch: branch === '<default>' ? undefined : branch,
      isPR: false, // TeamCity requires custom configuration for PR detection
    };
  }

  // Drone CI
  if (env['DRONE'] === 'true' || env['DRONE_BRANCH']) {
    const isPR = env['DRONE_BUILD_EVENT'] === 'pull_request';
    return {
      platform: 'Drone CI',
      isCI: true,
      branch:
        env['DRONE_SOURCE_BRANCH'] || env['DRONE_BRANCH'] || env['DRONE_COMMIT_BRANCH'],
      isPR,
      sourceBranch: env['DRONE_SOURCE_BRANCH'],
      targetBranch: env['DRONE_TARGET_BRANCH'],
      tag: env['DRONE_TAG'],
    };
  }

  // Buildkite
  if (env['BUILDKITE'] === 'true' || env['BUILDKITE_BUILD_ID']) {
    const isPR =
      !!env['BUILDKITE_PULL_REQUEST'] && env['BUILDKITE_PULL_REQUEST'] !== 'false';
    return {
      platform: 'Buildkite',
      isCI: true,
      branch: env['BUILDKITE_BRANCH'] || env['BUILDKITE_TAG'],
      isPR,
      targetBranch: env['BUILDKITE_PULL_REQUEST_BASE_BRANCH'],
      tag: env['BUILDKITE_TAG'],
    };
  }

  // Generic CI detection (fallback)
  if (env['CI'] === 'true' || env['CONTINUOUS_INTEGRATION'] === 'true') {
    return {
      platform: 'Generic CI',
      isCI: true,
      branch: undefined, // No standard env var, will fall back to git
      isPR: false,
    };
  }

  // Not in CI
  return {
    platform: 'None',
    isCI: false,
    branch: undefined,
    isPR: false,
  };
}

/** Extracts branch name from git refs like "refs/heads/main" or "refs/pull/123/merge" */
function extractBranchFromRef(ref: string | undefined): string | undefined {
  if (!ref) return undefined;

  // Remove refs/heads/ prefix
  if (ref.startsWith('refs/heads/')) {
    return ref.replace(/^refs\/heads\//, '');
  }

  // Remove refs/tags/ prefix
  if (ref.startsWith('refs/tags/')) {
    return ref.replace(/^refs\/tags\//, '');
  }

  // Remove refs/pull/ or refs/merge-requests/ (keep as-is for now)
  return ref;
}

/**
 * Gets the branch name with CI detection priority. Returns undefined if not in CI or
 * branch cannot be detected.
 */
export function getCIBranchName(): string | undefined {
  const ciInfo = detectCIBranch();

  if (!ciInfo.isCI) {
    return undefined;
  }

  return ciInfo.branch;
}
