import { coverageCoreConfig, jsPackagesCoreConfig } from '../../code-pushup.preset';
import { mergeConfigs } from '@code-pushup/utils';

const projectName = process.env['NX_TASK_TARGET_PROJECT'] || 'zephyr-agent';

export default mergeConfigs(
  await coverageCoreConfig({
    projectName,
  }),
  await jsPackagesCoreConfig(projectName)
);
