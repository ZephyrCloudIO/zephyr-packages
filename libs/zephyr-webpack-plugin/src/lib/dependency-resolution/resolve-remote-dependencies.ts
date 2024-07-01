import { Configuration } from 'webpack';
import { replaceRemotesWithDelegates } from './replace-remotes-with-delegates';
import { DependencyResolutionError } from '../../delegate-module/zephyr-delegate';
import { brightRedBgName } from 'zephyr-edge-contract';

export async function resolve_remote_dependencies(
  config: Configuration,
  app: {
    org: string;
    project: string;
  }
): Promise<void> {
  const resolvedDeps = await replaceRemotesWithDelegates(config, {
    org: app.org,
    project: app.project,
  });
  const errors = resolvedDeps
    .flat()
    .filter((res: unknown) => res && (res as DependencyResolutionError).error)
    .map((result: unknown) => {
      return (result as DependencyResolutionError).application_uid;
    });
  if (errors?.length) {
    const [sample_app_name, sample_project_name, sample_org_name] =
      errors[0].split('.');
    throw new Error(`${brightRedBgName} Could not resolve remote entry points for urls: \n
      ${errors.map((str) => `\t- ${str}`).join('\n')}\n\n
        Please build them with Zephyr first or add as Unmanaged applications.\n
        Note: you can read application uid as follows:
        \t - ${sample_app_name} - project.json 'name' field of remote application
        \t - ${sample_project_name} - git repository name
        \t - ${sample_org_name} - git organization name

        Or join and ask question in our discord: https://discord.gg/EqFbSSt8Hx
      `);
  }
}
