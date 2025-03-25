import { jsPackagesCoreConfig } from '../../code-pushup.preset';
import { mergeConfigs } from '@code-pushup/utils';

const projectName = process.env['NX_TASK_TARGET_PROJECT'] || 'parcel-reporter-zephyr';

export default mergeConfigs(await jsPackagesCoreConfig(projectName));
