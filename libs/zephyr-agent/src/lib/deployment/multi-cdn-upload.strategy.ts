import type { DeploymentResult } from 'zephyr-edge-contract';
import type { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { zeUploadSnapshot } from '../edge-actions';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import type {
  UploadProviderType,
  ZeApplicationConfig,
} from '../node-persist/upload-provider-options';
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

/** Creates a deployment result object for tracking CDN deployment status */
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
 * Deploys to a single CDN configuration with a specific config override Note: Does NOT
 * upload build stats - that should be done once after all deployments
 */
async function deploySingleCdn(
  zephyr_engine: ZephyrEngine,
  config: ZeApplicationConfig,
  { snapshot, assets: { assetsMap, missingAssets } }: UploadOptions
): Promise<string> {
  // Create a per-deployment engine view with the overridden application configuration
  // (preserve prototype methods; object spread would drop them and fail the ZephyrEngine type)
  const engineWithConfig: ZephyrEngine = Object.create(zephyr_engine);
  Object.defineProperty(engineWithConfig, 'application_configuration', {
    value: Promise.resolve(config),
    configurable: true,
    enumerable: true,
    writable: true,
  });

  const [versionUrl] = await Promise.all([
    zeUploadSnapshot(engineWithConfig, { snapshot }),
    uploadAssets(engineWithConfig, { assetsMap, missingAssets }),
  ]);
  return versionUrl;
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
    throw new ZephyrError(ZeErrors.PRIMARY_CDN_DEPLOYMENT_FAILED, {
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
    throw new ZephyrError(ZeErrors.PRIMARY_CDN_DEPLOYMENT_FAILED, {
      cause: error,
      data: {
        integrationName: primaryConfig._metadata?.integrationName,
        platform: primaryConfig.PLATFORM,
      },
    });
  }

  // Avoid uploading build stats twice (once here and again when reporting secondary deployments).
  // If there are secondary CDNs, defer the upload until after all secondary attempts complete.
  if (secondaryConfigs.length === 0) {
    ze_log.upload('Reporting primary deployment status to backend...');
    await uploadBuildStatsAndEnableEnvs(zephyr_engine, {
      getDashData: uploadOptions.getDashData,
      versionUrl: primaryUrl,
      deploymentResults: [primaryResult],
    });
  } else {
    ze_log.upload(
      'Deferring primary deployment status/build stats upload until after secondary deployments complete...'
    );
  }

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

  const secondaryDeploymentResults: DeploymentResult[] = secondaryResults.map(
    (result, index) => {
      const config = secondaryConfigs[index];
      if (result.status === 'fulfilled') {
        return createDeploymentResult(config, 'SUCCESS', result.value.url);
      } else {
        const errorMessage =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        return createDeploymentResult(config, 'FAILED', undefined, errorMessage);
      }
    }
  );

  const successfulSecondaries = secondaryResults
    .filter(
      (
        result
      ): result is PromiseFulfilledResult<{
        integrationName: string;
        url: string;
        platform: UploadProviderType;
        config: ZeApplicationConfig;
      }> => result.status === 'fulfilled'
    )
    .map((result) => ({
      integrationName: result.value.integrationName,
      url: result.value.url,
      platform: result.value.platform,
    }));

  const failedSecondaries = secondaryResults.filter(
    (result) => result.status === 'rejected'
  );
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
