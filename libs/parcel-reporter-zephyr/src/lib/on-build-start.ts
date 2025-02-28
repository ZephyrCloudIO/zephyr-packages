import type { ZephyrEngineOptions } from 'zephyr-agent';

interface OnBuildStartProps {
  zephyr_defer_create: (options: ZephyrEngineOptions) => void;
  projectRoot: string;
}
export async function onBuildStart(props: OnBuildStartProps): Promise<void> {
  const { zephyr_defer_create, projectRoot } = props;
  zephyr_defer_create({
    builder: 'parcel',
    context: projectRoot,
  });
}
