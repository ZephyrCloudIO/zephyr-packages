import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../scripts/rstest/project-config.mts';

export default defineProject(
  createProjectConfig({ name: 'zephyr-xpack-internal', root: import.meta.dirname })
);
