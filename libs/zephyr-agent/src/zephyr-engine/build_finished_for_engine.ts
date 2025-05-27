import { cyanBright, yellow } from '../lib/logging/picocolor';
import type { Platform } from './create_zephyr_engine';
import type { ZeResolvedDependency } from './resolve_remote_dependency';

export interface BuildFinishedContext {
  logger: Promise<unknown>;
  build_start_time: number | null;
  version_url: string | null;
  federated_dependencies: ZeResolvedDependency[] | null;
  env: { target: Platform };
}

export async function build_finished_for_engine(
  context: BuildFinishedContext
): Promise<void> {
  const logger = (await context.logger) as (logEntry: unknown) => void;
  const zeStart = context.build_start_time;
  const versionUrl = context.version_url;
  const dependencies = context.federated_dependencies;

  const if_target_is_react_native =
    context.env.target === 'ios' || context.env.target === 'android';

  if (zeStart && versionUrl) {
    if (dependencies && dependencies.length > 0) {
      logger({
        level: 'info',
        action: 'build:info:user',
        ignore: true,
        message: if_target_is_react_native
          ? `Resolved zephyr dependencies: ${dependencies.map((dep) => dep.name).join(', ')} for platform: ${context.env.target}`
          : `Resolved zephyr dependencies: ${dependencies.map((dep) => dep.name).join(', ')}`,
      });
    }

    logger({
      level: 'trace',
      action: 'deploy:url',
      message: `Deployed to ${cyanBright('Zephyr')}'s edge in ${yellow(`${Date.now() - zeStart}`)}ms.\n\n${cyanBright(versionUrl)}`,
    });
  }
}
