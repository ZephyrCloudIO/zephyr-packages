import { ZeErrors, ZephyrError } from '../../errors';
import { getGitProviderInfo } from '../git-provider-utils';

describe('Git Provider Utils', () => {
  describe('getGitProviderInfo', () => {
    it('should parse GitHub URLs correctly', () => {
      const githubUrl = 'https://github.com/ZephyrCloudIO/zephyr-packages.git';
      const result = getGitProviderInfo(githubUrl);

      expect(result).toEqual({
        provider: 'github',
        owner: 'zephyrcloudio',
        project: 'zephyr-packages',
        isEnterprise: false,
      });
    });

    it('should parse GitHub SSH URLs correctly', () => {
      const githubSshUrl = 'git@github.com:ZephyrCloudIO/zephyr-packages.git';
      const result = getGitProviderInfo(githubSshUrl);

      expect(result).toEqual({
        provider: 'github',
        owner: 'zephyrcloudio',
        project: 'zephyr-packages',
        isEnterprise: false,
      });
    });

    it('should parse GitHub Enterprise URLs correctly', () => {
      const githubEnterpriseUrl =
        'https://git.company.com/ZephyrCloudIO/zephyr-packages.git';
      const result = getGitProviderInfo(githubEnterpriseUrl);

      expect(result).toEqual({
        provider: 'custom',
        owner: 'company-com',
        project: 'zephyr-packages',
        isEnterprise: true,
      });
    });

    it('should parse GitLab URLs correctly', () => {
      const gitlabUrl = 'https://gitlab.com/ZephyrCloudIO/zephyr-packages.git';
      const result = getGitProviderInfo(gitlabUrl);

      expect(result).toEqual({
        provider: 'gitlab',
        owner: 'zephyrcloudio',
        project: 'zephyr-packages',
        isEnterprise: false,
      });
    });

    it('should parse GitLab URLs with subgroups correctly', () => {
      const gitlabSubgroupUrl =
        'https://gitlab.com/ZephyrCloudIO/team/zephyr-packages.git';
      const result = getGitProviderInfo(gitlabSubgroupUrl);

      expect(result).toEqual({
        provider: 'gitlab',
        owner: 'zephyrcloudio',
        project: 'zephyr-packages',
        isEnterprise: false,
      });
    });

    it('should parse GitLab self-hosted URLs correctly', () => {
      const gitlabSelfHostedUrl =
        'https://gitlab.company.com/ZephyrCloudIO/zephyr-packages.git';
      const result = getGitProviderInfo(gitlabSelfHostedUrl);

      expect(result).toEqual({
        provider: 'custom',
        owner: 'company-com',
        project: 'zephyr-packages',
        isEnterprise: true,
      });
    });

    it('should parse self-hosted GitLab URLs with deep subgroups correctly', () => {
      const selfHostedWithSubgroups =
        'git@gitlab.acme-corp.io:engineering/backend/service-api.git';
      const result = getGitProviderInfo(selfHostedWithSubgroups);

      expect(result).toEqual({
        provider: 'custom',
        owner: 'acme-corp-io',
        project: 'service-api',
        isEnterprise: true,
      });
    });

    it('should parse GitHub Enterprise SSH URLs with team correctly', () => {
      const enterpriseGithub = 'git@github.example-org.io:devteam/web-frontend.git';
      const result = getGitProviderInfo(enterpriseGithub);

      expect(result).toEqual({
        provider: 'custom',
        owner: 'example-org-io',
        project: 'web-frontend',
        isEnterprise: true,
      });
    });

    it('should parse Bitbucket URLs correctly', () => {
      const bitbucketUrl = 'https://bitbucket.org/ZephyrCloudIO/zephyr-packages.git';
      const result = getGitProviderInfo(bitbucketUrl);

      expect(result).toEqual({
        provider: 'bitbucket',
        owner: 'zephyrcloudio',
        project: 'zephyr-packages',
        isEnterprise: false,
      });
    });

    it('should parse Azure DevOps SSH URLs correctly', () => {
      const azureSshUrl = 'git@ssh.dev.azure.com:v3/BusinessDomain/AddSecure/AddSecure';
      const result = getGitProviderInfo(azureSshUrl);

      expect(result).toEqual({
        provider: 'azure',
        owner: 'businessdomain',
        project: 'addsecure',
        isEnterprise: false,
      });
    });

    it('should parse legacy Azure DevOps SSH URLs correctly', () => {
      const azureSshUrl =
        'git@vs-ssh.visualstudio.com:v3/BusinessDomain/AddSecure/AddSecure.git';
      const result = getGitProviderInfo(azureSshUrl);

      expect(result).toEqual({
        provider: 'azure',
        owner: 'businessdomain',
        project: 'addsecure',
        isEnterprise: false,
      });
    });

    it('should parse Azure DevOps SSH host aliases correctly', () => {
      const azureSshAliasUrl =
        'git@devops_businessdomain:v3/BusinessDomain/AddSecure/AddSecure';
      const result = getGitProviderInfo(azureSshAliasUrl);

      expect(result).toEqual({
        provider: 'azure',
        owner: 'businessdomain',
        project: 'addsecure',
        isEnterprise: false,
      });
    });

    it('should parse Azure DevOps HTTPS URLs correctly', () => {
      const azureHttpsUrl =
        'https://BusinessDomain@dev.azure.com/BusinessDomain/AddSecure/_git/Frontend.git';
      const result = getGitProviderInfo(azureHttpsUrl);

      expect(result).toEqual({
        provider: 'azure',
        owner: 'businessdomain',
        project: 'frontend',
        isEnterprise: false,
      });
    });

    it('should parse Azure DevOps HTTPS URLs without username correctly', () => {
      const azureHttpsUrl =
        'https://dev.azure.com/BusinessDomain/AddSecure/_git/Frontend';
      const result = getGitProviderInfo(azureHttpsUrl);

      expect(result).toEqual({
        provider: 'azure',
        owner: 'businessdomain',
        project: 'frontend',
        isEnterprise: false,
      });
    });

    it('should parse legacy visualstudio.com Azure DevOps HTTPS URLs correctly', () => {
      const azureHttpsUrl =
        'https://BusinessDomain.visualstudio.com/AddSecure/_git/Frontend';
      const result = getGitProviderInfo(azureHttpsUrl);

      expect(result).toEqual({
        provider: 'azure',
        owner: 'businessdomain',
        project: 'frontend',
        isEnterprise: false,
      });
    });

    it('should parse legacy visualstudio.com collection HTTPS URLs correctly', () => {
      const azureHttpsUrl =
        'https://BusinessDomain.visualstudio.com/DefaultCollection/AddSecure/_git/Frontend';
      const result = getGitProviderInfo(azureHttpsUrl);

      expect(result).toEqual({
        provider: 'azure',
        owner: 'businessdomain',
        project: 'frontend',
        isEnterprise: false,
      });
    });

    it('should parse custom domain Git URLs correctly', () => {
      const customUrl = 'https://git.custom-domain.com/ZephyrCloudIO/zephyr-packages.git';
      const result = getGitProviderInfo(customUrl);

      expect(result).toEqual({
        provider: 'custom',
        owner: 'custom-domain-com',
        project: 'zephyr-packages',
        isEnterprise: true,
      });
    });

    it('should throw an error for invalid or empty URLs', () => {
      expect(() => getGitProviderInfo('')).toThrow(
        new ZephyrError(ZeErrors.ERR_GIT_REMOTE_ORIGIN)
      );
    });
  });
});
