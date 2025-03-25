import { nxPerformanceCoreConfig, jsPackagesCoreConfig } from './code-pushup.preset';
import { mergeConfigs } from '@code-pushup/utils';

export default mergeConfigs(
  await nxPerformanceCoreConfig(),
  await jsPackagesCoreConfig()
);
