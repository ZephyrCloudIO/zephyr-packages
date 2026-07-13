import type { ZephyrBuildTarget, ZephyrEngineOptions } from 'zephyr-agent';

interface OnBuildStartProps {
  zephyr_defer_create: (options: ZephyrEngineOptions) => void;
  projectRoot: string;
  target?: ZephyrBuildTarget;
}
export async function onBuildStart(props: OnBuildStartProps): Promise<void> {
  const { zephyr_defer_create, projectRoot, target } = props;
  zephyr_defer_create({
    builder: 'parcel',
    context: projectRoot,
    ...(target === undefined ? {} : { target }),
  });
}
