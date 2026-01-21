import { detectCIBranch, getCIBranchName } from '../ci-branch-detection';

describe('detectCIBranch', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear all CI-related env vars
    Object.keys(process.env).forEach((key) => {
      if (
        key.startsWith('GITHUB_') ||
        key.startsWith('GITLAB_') ||
        key.startsWith('CI_') ||
        key.startsWith('JENKINS_') ||
        key.startsWith('BITBUCKET_') ||
        key.startsWith('CIRCLE_') ||
        key.startsWith('TRAVIS_') ||
        key.startsWith('BUILD_') ||
        key.startsWith('SYSTEM_') ||
        key.startsWith('TF_') ||
        key.startsWith('AZURE_') ||
        key.startsWith('TEAMCITY_') ||
        key.startsWith('DRONE_') ||
        key.startsWith('BUILDKITE_') ||
        key === 'CI' ||
        key === 'CONTINUOUS_INTEGRATION'
      ) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GitHub Actions', () => {
    it('should detect regular branch push', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REF_NAME = 'feature/awesome';
      process.env.GITHUB_REF = 'refs/heads/feature/awesome';

      const result = detectCIBranch();

      expect(result.platform).toBe('GitHub Actions');
      expect(result.isCI).toBe(true);
      expect(result.branch).toBe('feature/awesome');
      expect(result.isPR).toBe(false);
    });

    it('should detect pull request with source branch', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_HEAD_REF = 'feature/pr-branch';
      process.env.GITHUB_BASE_REF = 'main';
      process.env.GITHUB_REF = 'refs/pull/123/merge';

      const result = detectCIBranch();

      expect(result.platform).toBe('GitHub Actions');
      expect(result.branch).toBe('feature/pr-branch');
      expect(result.isPR).toBe(true);
      expect(result.sourceBranch).toBe('feature/pr-branch');
      expect(result.targetBranch).toBe('main');
    });

    it('should detect tag builds', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REF = 'refs/tags/v1.0.0';
      process.env.GITHUB_REF_NAME = 'v1.0.0';

      const result = detectCIBranch();

      expect(result.platform).toBe('GitHub Actions');
      expect(result.branch).toBe('v1.0.0');
      expect(result.tag).toBe('v1.0.0');
    });

    it('should fallback to extracting from GITHUB_REF', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REF = 'refs/heads/develop';

      const result = detectCIBranch();

      expect(result.platform).toBe('GitHub Actions');
      expect(result.branch).toBe('develop');
    });
  });

  describe('GitLab CI', () => {
    it('should detect regular branch', () => {
      process.env.GITLAB_CI = 'true';
      process.env.CI_COMMIT_BRANCH = 'feature/gitlab';
      process.env.CI_COMMIT_REF_NAME = 'feature/gitlab';

      const result = detectCIBranch();

      expect(result.platform).toBe('GitLab CI');
      expect(result.isCI).toBe(true);
      expect(result.branch).toBe('feature/gitlab');
      expect(result.isPR).toBe(false);
    });

    it('should detect merge request', () => {
      process.env.GITLAB_CI = 'true';
      process.env.CI_MERGE_REQUEST_ID = '42';
      process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME = 'feature/mr';
      process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME = 'main';
      process.env.CI_COMMIT_REF_NAME = 'feature/mr';

      const result = detectCIBranch();

      expect(result.platform).toBe('GitLab CI');
      expect(result.branch).toBe('feature/mr');
      expect(result.isPR).toBe(true);
      expect(result.sourceBranch).toBe('feature/mr');
      expect(result.targetBranch).toBe('main');
    });

    it('should detect tag builds', () => {
      process.env.GITLAB_CI = 'true';
      process.env.CI_COMMIT_REF_NAME = 'v2.0.0';
      // CI_COMMIT_BRANCH is not set for tags

      const result = detectCIBranch();

      expect(result.platform).toBe('GitLab CI');
      expect(result.branch).toBe('v2.0.0');
      expect(result.tag).toBe('v2.0.0');
    });
  });

  describe('Jenkins', () => {
    it('should detect multibranch pipeline', () => {
      process.env.JENKINS_URL = 'https://jenkins.example.com';
      process.env.BRANCH_NAME = 'feature/jenkins';

      const result = detectCIBranch();

      expect(result.platform).toBe('Jenkins');
      expect(result.isCI).toBe(true);
      expect(result.branch).toBe('feature/jenkins');
      expect(result.isPR).toBe(false);
    });

    it('should detect pull request in multibranch', () => {
      process.env.JENKINS_URL = 'https://jenkins.example.com';
      process.env.BRANCH_NAME = 'PR-24';
      process.env.CHANGE_ID = '24';
      process.env.CHANGE_BRANCH = 'feature/actual-branch';
      process.env.CHANGE_TARGET = 'main';

      const result = detectCIBranch();

      expect(result.platform).toBe('Jenkins');
      expect(result.branch).toBe('feature/actual-branch');
      expect(result.isPR).toBe(true);
      expect(result.sourceBranch).toBe('feature/actual-branch');
      expect(result.targetBranch).toBe('main');
    });

    it('should strip origin/ prefix from GIT_BRANCH', () => {
      process.env.JENKINS_HOME = '/var/jenkins';
      process.env.GIT_BRANCH = 'origin/develop';

      const result = detectCIBranch();

      expect(result.platform).toBe('Jenkins');
      expect(result.branch).toBe('develop');
    });
  });

  describe('Bitbucket Pipelines', () => {
    it('should detect branch', () => {
      process.env.BITBUCKET_BUILD_NUMBER = '123';
      process.env.BITBUCKET_BRANCH = 'feature/bitbucket';

      const result = detectCIBranch();

      expect(result.platform).toBe('Bitbucket Pipelines');
      expect(result.isCI).toBe(true);
      expect(result.branch).toBe('feature/bitbucket');
      expect(result.isPR).toBe(false);
    });

    it('should detect pull request', () => {
      process.env.BITBUCKET_BUILD_NUMBER = '124';
      process.env.BITBUCKET_BRANCH = 'feature/pr';
      process.env.BITBUCKET_PR_ID = '10';
      process.env.BITBUCKET_PR_DESTINATION_BRANCH = 'main';

      const result = detectCIBranch();

      expect(result.platform).toBe('Bitbucket Pipelines');
      expect(result.branch).toBe('feature/pr');
      expect(result.isPR).toBe(true);
      expect(result.targetBranch).toBe('main');
    });

    it('should detect tag builds', () => {
      process.env.BITBUCKET_BUILD_NUMBER = '125';
      process.env.BITBUCKET_TAG = 'v1.5.0';

      const result = detectCIBranch();

      expect(result.platform).toBe('Bitbucket Pipelines');
      expect(result.branch).toBe('v1.5.0');
      expect(result.tag).toBe('v1.5.0');
    });
  });

  describe('CircleCI', () => {
    it('should detect branch', () => {
      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_BRANCH = 'feature/circle';

      const result = detectCIBranch();

      expect(result.platform).toBe('CircleCI');
      expect(result.isCI).toBe(true);
      expect(result.branch).toBe('feature/circle');
      expect(result.isPR).toBe(false);
    });

    it('should detect pull request with CIRCLE_PULL_REQUEST', () => {
      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_BRANCH = 'feature/pr';
      process.env.CIRCLE_PULL_REQUEST = 'https://github.com/org/repo/pull/42';

      const result = detectCIBranch();

      expect(result.platform).toBe('CircleCI');
      expect(result.branch).toBe('feature/pr');
      expect(result.isPR).toBe(true);
    });

    it('should detect pull request with CIRCLE_PR_NUMBER (forked PRs)', () => {
      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_BRANCH = 'feature/fork-pr';
      process.env.CIRCLE_PR_NUMBER = '42';

      const result = detectCIBranch();

      expect(result.platform).toBe('CircleCI');
      expect(result.branch).toBe('feature/fork-pr');
      expect(result.isPR).toBe(true);
    });

    it('should detect pull request with CIRCLE_PULL_REQUESTS (multiple PRs)', () => {
      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_BRANCH = 'feature/multi-pr';
      process.env.CIRCLE_PULL_REQUESTS =
        'https://github.com/org/repo/pull/42,https://github.com/org/repo/pull/43';

      const result = detectCIBranch();

      expect(result.platform).toBe('CircleCI');
      expect(result.branch).toBe('feature/multi-pr');
      expect(result.isPR).toBe(true);
    });

    it('should detect tag builds', () => {
      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_TAG = 'v3.0.0';

      const result = detectCIBranch();

      expect(result.platform).toBe('CircleCI');
      expect(result.branch).toBe('v3.0.0');
      expect(result.tag).toBe('v3.0.0');
    });
  });

  describe('Travis CI', () => {
    it('should detect regular branch', () => {
      process.env.TRAVIS = 'true';
      process.env.TRAVIS_BRANCH = 'develop';
      process.env.TRAVIS_PULL_REQUEST = 'false';

      const result = detectCIBranch();

      expect(result.platform).toBe('Travis CI');
      expect(result.isCI).toBe(true);
      expect(result.branch).toBe('develop');
      expect(result.isPR).toBe(false);
    });

    it('should detect pull request with source branch', () => {
      process.env.TRAVIS = 'true';
      process.env.TRAVIS_PULL_REQUEST_BRANCH = 'feature/pr';
      process.env.TRAVIS_BRANCH = 'main'; // target branch in PR context
      process.env.TRAVIS_PULL_REQUEST = '42';

      const result = detectCIBranch();

      expect(result.platform).toBe('Travis CI');
      expect(result.branch).toBe('feature/pr');
      expect(result.isPR).toBe(true);
      expect(result.sourceBranch).toBe('feature/pr');
      expect(result.targetBranch).toBe('main');
    });
  });

  describe('Azure Pipelines', () => {
    it('should detect regular branch', () => {
      process.env.TF_BUILD = 'True';
      process.env.BUILD_SOURCEBRANCHNAME = 'feature/azure';
      process.env.BUILD_SOURCEBRANCH = 'refs/heads/feature/azure';

      const result = detectCIBranch();

      expect(result.platform).toBe('Azure Pipelines');
      expect(result.isCI).toBe(true);
      expect(result.branch).toBe('feature/azure');
      expect(result.isPR).toBe(false);
    });

    it('should detect pull request', () => {
      process.env.TF_BUILD = 'True';
      process.env.BUILD_SOURCEBRANCHNAME = 'merge'; // Azure sets this to "merge" for PRs
      process.env.SYSTEM_PULLREQUEST_PULLREQUESTID = '123';
      process.env.SYSTEM_PULLREQUEST_SOURCEBRANCH = 'refs/heads/feature/pr';
      process.env.SYSTEM_PULLREQUEST_TARGETBRANCH = 'refs/heads/main';

      const result = detectCIBranch();

      expect(result.platform).toBe('Azure Pipelines');
      expect(result.branch).toBe('feature/pr');
      expect(result.isPR).toBe(true);
      expect(result.sourceBranch).toBe('feature/pr');
      expect(result.targetBranch).toBe('main');
    });
  });

  describe('TeamCity', () => {
    it('should detect branch from custom env var', () => {
      process.env.TEAMCITY_VERSION = '2023.11';
      process.env.GIT_BRANCH = 'feature/teamcity';

      const result = detectCIBranch();

      expect(result.platform).toBe('TeamCity');
      expect(result.isCI).toBe(true);
      expect(result.branch).toBe('feature/teamcity');
      expect(result.isPR).toBe(false);
    });

    it('should handle <default> branch marker', () => {
      process.env.TEAMCITY_VERSION = '2023.11';
      process.env.GIT_BRANCH = '<default>';

      const result = detectCIBranch();

      expect(result.platform).toBe('TeamCity');
      expect(result.branch).toBeUndefined();
    });
  });

  describe('Drone CI', () => {
    it('should detect regular branch', () => {
      process.env.DRONE = 'true';
      process.env.DRONE_BRANCH = 'feature/drone';
      process.env.DRONE_BUILD_EVENT = 'push';

      const result = detectCIBranch();

      expect(result.platform).toBe('Drone CI');
      expect(result.isCI).toBe(true);
      expect(result.branch).toBe('feature/drone');
      expect(result.isPR).toBe(false);
    });

    it('should detect pull request', () => {
      process.env.DRONE = 'true';
      process.env.DRONE_SOURCE_BRANCH = 'feature/pr';
      process.env.DRONE_TARGET_BRANCH = 'main';
      process.env.DRONE_BUILD_EVENT = 'pull_request';

      const result = detectCIBranch();

      expect(result.platform).toBe('Drone CI');
      expect(result.branch).toBe('feature/pr');
      expect(result.isPR).toBe(true);
      expect(result.sourceBranch).toBe('feature/pr');
      expect(result.targetBranch).toBe('main');
    });
  });

  describe('Buildkite', () => {
    it('should detect branch', () => {
      process.env.BUILDKITE = 'true';
      process.env.BUILDKITE_BRANCH = 'feature/buildkite';
      process.env.BUILDKITE_PULL_REQUEST = 'false';

      const result = detectCIBranch();

      expect(result.platform).toBe('Buildkite');
      expect(result.isCI).toBe(true);
      expect(result.branch).toBe('feature/buildkite');
      expect(result.isPR).toBe(false);
    });

    it('should detect pull request', () => {
      process.env.BUILDKITE = 'true';
      process.env.BUILDKITE_BRANCH = 'feature/pr';
      process.env.BUILDKITE_PULL_REQUEST = '42';
      process.env.BUILDKITE_PULL_REQUEST_BASE_BRANCH = 'main';

      const result = detectCIBranch();

      expect(result.platform).toBe('Buildkite');
      expect(result.branch).toBe('feature/pr');
      expect(result.isPR).toBe(true);
      expect(result.targetBranch).toBe('main');
    });
  });

  describe('Generic CI', () => {
    it('should detect generic CI environment', () => {
      process.env.CI = 'true';

      const result = detectCIBranch();

      expect(result.platform).toBe('Generic CI');
      expect(result.isCI).toBe(true);
      expect(result.branch).toBeUndefined(); // No standard env var
      expect(result.isPR).toBe(false);
    });
  });

  describe('Non-CI environment', () => {
    it('should return not detected', () => {
      const result = detectCIBranch();

      expect(result.platform).toBe('None');
      expect(result.isCI).toBe(false);
      expect(result.branch).toBeUndefined();
      expect(result.isPR).toBe(false);
    });
  });
});

describe('getCIBranchName', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear env
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('GITHUB_') || key === 'CI') {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return branch name in CI', () => {
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_REF_NAME = 'develop';

    expect(getCIBranchName()).toBe('develop');
  });

  it('should return undefined when not in CI', () => {
    expect(getCIBranchName()).toBeUndefined();
  });

  it('should return undefined when in CI but no branch detected', () => {
    process.env.CI = 'true';

    expect(getCIBranchName()).toBeUndefined();
  });
});
