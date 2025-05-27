import { createApplicationUid } from 'zephyr-edge-contract';
import type { ZeGitInfo } from '../lib/build-context/ze-util-get-git-info';
import type { ZePackageJson } from '../lib/build-context/ze-package-json.type';

export interface ZeApplicationProperties {
  org: string;
  project: string;
  name: string;
  version: string;
}

export interface ZephyrEngineData {
  npmProperties: ZePackageJson;
  gitProperties: ZeGitInfo;
  applicationProperties: ZeApplicationProperties;
  application_uid: string;
}

export function mut_zephyr_app_uid(
  ze: Pick<ZephyrEngineData, 'npmProperties' | 'gitProperties'>
): {
  applicationProperties: ZeApplicationProperties;
  application_uid: string;
} {
  const applicationProperties: ZeApplicationProperties = {
    org: ze.gitProperties.app.org,
    project: ze.gitProperties.app.project,
    name: ze.npmProperties.name,
    version: ze.npmProperties.version,
  };
  const application_uid = createApplicationUid(applicationProperties);

  return { applicationProperties, application_uid };
}
