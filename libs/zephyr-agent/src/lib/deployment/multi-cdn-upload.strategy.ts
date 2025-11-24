import type { DeploymentResult } from 'zephyr-edge-contract';
import type { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { zeUploadSnapshot } from '../edge-actions';
import { ZephyrError } from '../errors';
import { ze_log } from '../logging';
import type { UploadProviderType, ZeApplicationConfig } from '../node-persist/upload-provider-options';
import { uploadAssets } from './upload-base/upload-assets';
import { uploadBuildStatsAndEnableEnvs } from './upload-base/upload-build-stats-and-enable-envs';

export interface MultiCdnUploadResult {
  primaryUrl: string;
  secondaryUrls: Array<{
    integrationName: string;
    url: string;
    platform: UploadProviderType;
  }>;
  allUrls: string[];
}

/**
 * Creates a deployment result object for tracking CDN deployment status
 */
function createDeploymentResult(
  config: ZeApplicationConfig,
  status: 'SUCCESS' | 'FAILED' | 'PENDING',
  deployedUrl?: string,
  errorMessage?: string
): DeploymentResult {
  return {
    integrationId: config._metadata?.integrationId || '',
    integrationName: config._metadata?.integrationName || 'unknown',
    platform: config.PLATFORM,
    status,
    deployedUrl,
    errorMessage,
    deployedAt: new Date().toISOString(),
  };
}

/**
 * Deploys to a single CDN configuration with a specific config override
 * Note: Does NOT upload build stats - that should be done once after all deployments
 */
async function deploySingleCdn(
  zephyr_engine: ZephyrEngine,
  config: ZeApplicationConfig,
  { snapshot, assets: { assetsMap, missingAssets } }: UploadOptions
): Promise<string> {
  // Temporarily override the application_configuration for this deployment
  const originalConfig = zephyr_engine.application_configuration;
  zephyr_engine.application_configuration = Promise.resolve(config);

  try {
    const [versionUrl] = await Promise.all([
      zeUploadSnapshot(zephyr_engine, { snapshot }),
      uploadAssets(zephyr_engine, { assetsMap, missingAssets }),
    ]);

    return versionUrl;
  } finally {
    // Restore original config
    zephyr_engine.application_configuration = originalConfig;
  }
}

export async function multiCdnUploadStrategy(
  zephyr_engine: ZephyrEngine,
  configs: ZeApplicationConfig[],
  uploadOptions: UploadOptions
): Promise<MultiCdnUploadResult> {
  if (configs.length === 0) {
    throw new ZephyrError('NO_CONFIGS_PROVIDED' as any, {
      data: { message: 'No application configs provided for multi-CDN deployment' },
    });
  }

  const primaryConfig = configs.find((c) => c._metadata?.isPrimary);
  const secondaryConfigs = configs.filter((c) => !c._metadata?.isPrimary);

  if (!primaryConfig) {
    ze_log.upload('✗ Primary deployment not found');
    throw new ZephyrError('PRIMARY_CDN_DEPLOYMENT_FAILED' as any, {
      cause: 'Primary deployment not found in multi-CDN configs',
    });
  }

  ze_log.upload(
    `Multi-CDN deployment: Primary=${primaryConfig._metadata?.integrationName}, Secondaries=${secondaryConfigs.length}`
  );

  ze_log.upload(
    `Deploying to primary CDN: ${primaryConfig._metadata?.integrationName} (${primaryConfig.PLATFORM})`
  );
  let primaryUrl: string;
  let primaryResult: DeploymentResult;
  try {
    primaryUrl = await deploySingleCdn(zephyr_engine, primaryConfig, uploadOptions);
    ze_log.upload(`✓ Primary deployment successful: ${primaryUrl}`);
    primaryResult = createDeploymentResult(primaryConfig, 'SUCCESS', primaryUrl);
  } catch (error) {
    ze_log.upload(`✗ Primary deployment failed: ${error}`);
    primaryResult = createDeploymentResult(
      primaryConfig,
      'FAILED',
      undefined,
      error instanceof Error ? error.message : String(error)
    );
    await uploadBuildStatsAndEnableEnvs(zephyr_engine, {
      getDashData: uploadOptions.getDashData,
      versionUrl: undefined,
      deploymentResults: [primaryResult],
    });
    throw new ZephyrError('PRIMARY_CDN_DEPLOYMENT_FAILED' as any, {
      cause: error,
      data: {
        integrationName: primaryConfig._metadata?.integrationName,
        platform: primaryConfig.PLATFORM,
      },
    });
  }

  ze_log.upload('Reporting primary deployment status to backend...');
  await uploadBuildStatsAndEnableEnvs(zephyr_engine, {
    getDashData: uploadOptions.getDashData,
    versionUrl: primaryUrl,
    deploymentResults: [primaryResult],
  });

  const secondaryResults = await Promise.allSettled(
    secondaryConfigs.map(async (config) => {
      ze_log.upload(
        `Deploying to secondary CDN: ${config._metadata?.integrationName} (${config.PLATFORM})`
      );
      try {
        const url = await deploySingleCdn(zephyr_engine, config, uploadOptions);
        ze_log.upload(
          `✓ Secondary deployment successful: ${config._metadata?.integrationName} -> ${url}`
        );
        return {
          integrationName: config._metadata?.integrationName || 'unknown',
          url,
          platform: config.PLATFORM,
          config,
        };
      } catch (error) {
        ze_log.upload(
          `✗ Secondary deployment failed: ${config._metadata?.integrationName} - ${error}`
        );
        throw error;
      }
    })
  );

  const secondaryDeploymentResults: DeploymentResult[] = secondaryResults.map((result, index) => {
    const config = secondaryConfigs[index];
    if (result.status === 'fulfilled') {
      return createDeploymentResult(config, 'SUCCESS', result.value.url);
    } else {
      const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
      return createDeploymentResult(config, 'FAILED', undefined, errorMessage);
    }
  });

  const successfulSecondaries = secondaryResults
    .filter((result): result is PromiseFulfilledResult<{ integrationName: string; url: string;
   platform: UploadProviderType; config: ZeApplicationConfig }> =>
      result.status === 'fulfilled'
    )
    .map((result) => ({
      integrationName: result.value.integrationName,
      url: result.value.url,
      platform: result.value.platform,
    }));

  const failedSecondaries = secondaryResults.filter((result) => result.status === 'rejected');
  if (failedSecondaries.length > 0) {
    ze_log.upload(
      `Warning: ${failedSecondaries.length} secondary deployment(s) failed (out of ${secondaryConfigs.length})`
    );
  }

  if (secondaryDeploymentResults.length > 0) {
    ze_log.upload('Reporting secondary deployment statuses to backend...');
    await uploadBuildStatsAndEnableEnvs(zephyr_engine, {
      getDashData: uploadOptions.getDashData,
      versionUrl: primaryUrl,
      deploymentResults: secondaryDeploymentResults,
    });
  }

  const allUrls = [primaryUrl, ...successfulSecondaries.map((s) => s.url)];

  ze_log.upload(
    `Multi-CDN deployment complete: ${successfulSecondaries.length + 1}/${configs.length} successful`
  );

  return {
    primaryUrl,
    secondaryUrls: successfulSecondaries,
    allUrls,
  };
}
