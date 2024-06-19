import { importJWK, jwtVerify } from 'jose';
import * as crypto from 'node:crypto';
import { NetlifyIntegrationConfig, ZeBuildAsset, ZeUploadBuildStats, request, ze_error, ze_log } from 'zephyr-edge-contract';
import { UploaderInterface } from '../interfaces';
import { UploadOptions } from '../upload';
import { LogEventOptions, logger } from '../../remote-logs/ze-log-event';
import { zeUploadBuildStats } from '../../actions';
import { jwt_secret_key, netlify_api_url } from '../../constants/netlify.constants';

export class NetlifyPagesStrategy implements UploaderInterface {
  private logEvent!: (opts: LogEventOptions) => void;

  async upload(options: UploadOptions): Promise<boolean> {
    const config = options.appConfig.INTEGRATION_CONFIG as NetlifyIntegrationConfig;
    this.logEvent = logger(options.pluginOptions);
    const site = await this.getSite(config.site_id, config.api_token);

    const envs = await this.uploadBuildStatsAndEnableEnvs(options);
    if (!envs) {
      ze_error('[zephyr]: Could not get envs');
      return false;
    }
    console.log('envs', envs.value);

    const jwtSecret = await this.getJwtSecret(site, config.api_token);
    await this.validateJwt(options.appConfig.jwt, jwtSecret as string);
    
    const domain = this.resolveDomain(site);
    const urlReplaceRegexp = new RegExp(`-${new URL(options.appConfig.EDGE_URL).host}$`);
    const branches = envs.value.urls
      .map((url) => new URL(url).host)
      .map((url) => url.replace(urlReplaceRegexp, ''))
      .map((branch) => this.resolveBranch(branch, domain));
    
    const deployedUrl: string[] = [];

    for (const branch of branches) {
      const url = this.resolveUrl(branch, domain);
      this.logEvent({
        level: 'trace',
        action: 'deploy:url',
        message: `deploying to ${url}`,
      });
      const result = await this.uploadAssets(site, config.api_token, options, {
        "deploy-previews": true,
        production: false,
        branch,
        title: `Deploy ${options.pluginOptions.application_uid} from Zephyr to ${branch} branch`,
      });
      if (!result) {
        this.logEvent({
          level: 'error',
          action: 'deploy:edge:failed',
          message: `failed deploying local build to edge`,
        });
        return false;
      }
      deployedUrl.push(url);
    }
    deployedUrl.forEach((url) => {
      this.logEvent({
        level: 'trace',
        action: 'deploy:url',
        message: `deployed to ${url}`,
      });
    });

    this.logEvent({
      level: 'info',
      action: 'build:deploy:done',
      message: `build deployed in ${Date.now() - options.zeStart}ms`,
    });

    ze_log('Build successfully deployed to pages deployment preview');
    return true;
  }

  private getCommonHeaders(apiToken: string) {
    return {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async getSite(siteId: string, apiToken: string): Promise<Site> {
    const url = new URL(`${netlify_api_url}/sites/${siteId}`);
    const response = await request<Site>(url, { headers: this.getCommonHeaders(apiToken) })
      .catch((err) => {
        ze_error(`[zephyr]: Error getting site ${siteId} \n ${JSON.stringify(err)}`);
        throw err;
      });
    return response as Site;
  }

  private async uploadBuildStatsAndEnableEnvs({appConfig, pluginOptions, getDashData}: UploadOptions): Promise<{ value: ZeUploadBuildStats } | void> {
    const dashData = getDashData({appConfig, pluginOptions});
    return zeUploadBuildStats(dashData);
  }

  private async getJwtSecret(site: Site, apiToken: string): Promise<string|null> {
    const url = new URL(`${netlify_api_url}/accounts/${site.account_id}/env/${jwt_secret_key}`);
    url.searchParams.append('site_id', site.site_id);
    const response = await request<EnvVar>(url, { headers: this.getCommonHeaders(apiToken) })
      .catch((err) => {
        ze_error(`[zephyr]: Error getting env var ${jwt_secret_key} \n ${JSON.stringify(err)}`);
        console.error(err);
        return null;
      });
    const envVar = response as EnvVar;
    return envVar.values[0].value;
  }

  private async validateJwt(jwt: any, jwtSecret: string): Promise<void> {
    const _public_token = await importJWK(JSON.parse(jwtSecret), 'RS256');
    const { payload } = await jwtVerify<{
      application_uid: string;
      can_write: boolean;
      username: string;
    }>(jwt, _public_token);
    const { can_write, username, application_uid } = payload;
    if (!can_write) {
      throw new Error(`User ${username} is not allowed to update ${application_uid}`);
    }
  }

  private async uploadAssets(site: Site, apiToken: string, options: UploadOptions, deployOpts?: CreateDeployQueryParams): Promise<boolean> {
    const { assetsMap, missingAssets, count } = options;

    this.logEvent({
      level: 'info',
      action: 'snapshot:assets:upload:started',
      message: `uploading assets to zephyr (queued ${missingAssets?.length} out of ${count})`,
    });
  
    let totalTime = 0;
    let totalSize = 0;
    const files: Record<string, string> = {};
    const filesHashMap: Record<string, ZeBuildAsset> = {};
    Object.keys(assetsMap).forEach((key) => {
      const asset = assetsMap[key];
      // recalculating hash to make sure it's the same as the one in the Netlify. https://docs.netlify.com/api/get-started/#file-digest-method
      const hash = this.getFileContentHash(asset.buffer);
      files[asset.path] = hash;
      filesHashMap[hash] = asset;
    });

    const deploy = await this.createDeploy(site, apiToken, { files }, deployOpts);
    const assetsToDeploy = deploy.required.map((hash) => filesHashMap[hash]);
    await Promise.all(
      assetsToDeploy.map(async (asset) => {
        const start = Date.now();
        const assetWithBuffer = assetsMap[asset.hash];
        const assetSize = assetWithBuffer?.buffer?.length / 1024;
        console.debug('uploading file', asset.path, assetSize.toFixed(2) + 'kb', files[asset.path]);
        return this.uploadDeployFile({
          deployId: deploy.id,
          path: asset.path,
          content: assetWithBuffer.buffer,
          api_token: apiToken,
        })
          .then(() => {
            const fileUploaded = Date.now() - start;
            totalTime += fileUploaded;
            totalSize += assetSize;
            console.debug(`file ${asset.path} uploaded in ${fileUploaded}ms (${assetSize.toFixed(2)}kb)`);
            this.logEvent({
              level: 'info',
              action: 'snapshot:assets:upload:file:done',
              message: `file ${asset.path} uploaded in ${fileUploaded}ms (${assetSize.toFixed(2)}kb)`,
            });
          })
          .catch((err) => {
            this.logEvent({
              level: 'error',
              action: 'snapshot:assets:upload:file:failed',
              message: `failed to upload file ${asset.path} \n ${JSON.stringify(err)}`,
            });
            throw err;
          });
      })
    )
      .then(() => {
        this.logEvent({
          level: 'info',
          action: 'snapshot:assets:upload:done',
          message: `uploaded missing assets to zephyr (${
            missingAssets?.length
          } assets in ${totalTime}ms, ${totalSize.toFixed(2)}kb)`,
        });
        return true;
      })
      .catch((err) => {
        this.logEvent({
          level: 'error',
          action: 'snapshot:assets:upload:failed',
          message: `failed to upload assets to zephyr \n ${JSON.stringify(err)}`,
        });
        throw err;
      });

    return true;

  }

  private async createDeploy(site: Site, apiToken: string, payload: CreateDeployRequest, query?: CreateDeployQueryParams): Promise<DeployResponse> {
    const data = JSON.stringify(payload);
    const url = new URL(`${netlify_api_url}/sites/${site.site_id}/deploys`);
    if (query) {
      Object.keys(query).forEach((key) => {
        const value = (query as unknown as Record<string, string|boolean|number>)[key];
        url.searchParams.append(key, value.toString());
      });
    }
    const response = await request<DeployResponse>(url, {
      method: 'POST',
      headers: this.getCommonHeaders(apiToken),
    }, data);
    return response as DeployResponse;
  }

  private async uploadDeployFile(params: UploadDeployFileParams): Promise<UploadDeployFunctionFileResponse> {
    const url = new URL(`${netlify_api_url}/deploys/${params.deployId}/files/${params.path}`);
    const response = await request<UploadDeployFunctionFileResponse>(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${params.api_token}`,
        'Content-Type': 'application/octet-stream',
      },
    }, params.content)
      .catch((err) => {
        ze_error(`[zephyr]: Error uploading file ${params.path} \n ${JSON.stringify(err)}`);
        throw err;
      });
    return response as UploadDeployFunctionFileResponse;
  }

  private resolveDomain(site: Site): string {
    return site.default_domain;
  }
  
  private getFileContentHash(content: string | Buffer): string {
    const hash = crypto.createHash('sha1').update(content).digest('hex');
    return hash;
  }

  private resolveUrl(branch: string, domain: string): string {
    return `https://${branch}--${domain}`;
  }

  private resolveBranch(branch: string, domain: string): string {
    return branch.slice(0, -(domain.length + 2));
  }
}

export function netlifyPageStrategy(options: UploadOptions): Promise<boolean> {
  const strategy = new NetlifyPagesStrategy();
  return strategy.upload(options);
}


interface Site {
  id: string;
  site_id: string;
  name: string;
  custom_domain?: string;
  branch_deploy_custom_domain?: string;
  deploy_preview_custom_domain?: string;
  url: string;
  account_id: string;
  default_domain: string;
}

interface EnvVar {
  ke: string;
  scopes: string[];
  values: {
    id: string;
    value: string;
    context: string;
    role: string;
  }[];
  is_secret: boolean;
}

interface CreateDeployRequest {
  files?: Record<string, string>;
}

interface CreateDeployQueryParams {
  branch?: string;
  title?: string;
  production?: boolean;
  'deploy-previews'?: boolean;
}

interface DeployResponse {
  id: string;
  site_id: string;
  user_id: string;
  build_id: string;
  state: string;
  name: string;
  url: string;
  deploy_url: string;
  required: string[];
  error_message: string;
  branch: string;
}

interface UploadDeployFileParams {
  deployId: string;
  path: string;
  content: string|Buffer;
  api_token: string;
}

interface UploadDeployFunctionFileResponse {
  path: string;
}