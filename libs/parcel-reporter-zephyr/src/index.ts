import { Reporter } from '@parcel/plugin';
import {
  assertZephyrBundlerBuildTarget,
  handleGlobalError,
  isZephyrDisabled,
  logZephyrDisabled,
  ZeErrors,
  ZephyrEngine,
  ZephyrError,
  type ZephyrBuildHooks,
  type ZephyrBundlerBuildTarget,
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
  target?: ZephyrBundlerBuildTarget;
  hooks?: ZephyrBuildHooks;
  /** Every independently published Module Federation container in the snapshot. */
  mfConfigs?: ZephyrModuleFederationConfig[];
  /** Build-stat metadata paired with every entry in `mfConfigs`. */
  federation?: ZephyrModuleFederationBuildMetadata[];
}

/** Turns Parcel's failure diagnostics into the error reported as `build:failed`. */
function buildFailureError(
  diagnostics: readonly { message?: string }[] | undefined
): ZephyrError<'ERR_DEPLOY_LOCAL_BUILD'> {
  const details = (diagnostics ?? [])
    .map((diagnostic) => diagnostic.message)
    .filter((message): message is string => !!message);
  return new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
    message: details.length > 0 ? details.join('\n') : 'Parcel build failed.',
  });
}

function createZephyrReporter(options?: ZephyrParcelReporterOptions) {
  if (options?.target !== undefined) {
    assertZephyrBundlerBuildTarget(options.target, 'createZephyrReporter({ target })');
  }
  assertTapModuleFederationMetadata(
    options?.target,
    options?.mfConfigs,
    options?.federation
  );

  // Create the engine and assets map outside the reporter function
  // so they persist between calls
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  let announcedDisabled = false;

  return new Reporter({
    report: async ({ event, options: parcelOptions }) => {
      try {
        // Skip mode: Parcel builds the bundle as it is. No engine, token, git
        // information or request. Only a successful build reports it was not deployed.
        if (isZephyrDisabled()) {
          if (event.type === 'buildSuccess' && !announcedDisabled) {
            announcedDisabled = true;
            logZephyrDisabled();
          }
          return;
        }

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
                await zephyr_engine.build_failed(buildFailureError(event.diagnostics));
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
