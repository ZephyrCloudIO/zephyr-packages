import { Reporter } from '@parcel/plugin';
import {
  assertZephyrBuildTarget,
  handleGlobalError,
  ZephyrEngine,
  type ZephyrBuildHooks,
  type ZephyrBuildTarget,
} from 'zephyr-agent';
import type {
  ZephyrModuleFederationBuildMetadata,
  ZephyrModuleFederationConfig,
} from 'zephyr-edge-contract';
import { onBuildStart } from './lib/on-build-start';
import {
  assertTapModuleFederationMetadata,
  onBuildSuccess,
} from './lib/on-build-success';

export interface ZephyrParcelReporterOptions {
  /** Zephyr artifact family, including `tap-app` for TAP packages. */
  target?: ZephyrBuildTarget;
  hooks?: ZephyrBuildHooks;
  /** Every independently published Module Federation container in the snapshot. */
  mfConfigs?: ZephyrModuleFederationConfig[];
  /** Build-stat metadata paired with every entry in `mfConfigs`. */
  federation?: ZephyrModuleFederationBuildMetadata[];
}

function createZephyrReporter(options?: ZephyrParcelReporterOptions) {
  if (options?.target !== undefined) {
    assertZephyrBuildTarget(options.target, 'createZephyrReporter({ target })');
  }
  assertTapModuleFederationMetadata(
    options?.target,
    options?.mfConfigs,
    options?.federation
  );

  // Create the engine and assets map outside the reporter function
  // so they persist between calls
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  return new Reporter({
    report: async ({ event, options: parcelOptions }) => {
      try {
        const projectRoot = parcelOptions.inputFS.cwd();

        switch (event.type) {
          case 'buildStart':
            await onBuildStart({
              zephyr_defer_create,
              projectRoot,
              target: options?.target,
            });
            break;
          case 'buildSuccess':
            await onBuildSuccess({
              zephyr_engine_defer,
              event,
              hooks: options?.hooks,
              mfConfigs: options?.mfConfigs,
              federation: options?.federation,
            });
            break;
          case 'buildFailure':
            {
              const zephyr_engine = await zephyr_engine_defer;
              if (zephyr_engine.hasActiveBuild) {
                zephyr_engine.build_failed();
              }
            }
            break;
          default:
            // ignore unknown build hooks
            break;
        }
      } catch (error) {
        handleGlobalError(error);
      }
    },
  });
}

export { createZephyrReporter };
export type { ZephyrBuildHooks, DeploymentInfo } from 'zephyr-agent';
export default createZephyrReporter();
