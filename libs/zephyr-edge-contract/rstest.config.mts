import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../scripts/rstest/project-config.mts';

export default defineProject(
  createProjectConfig({ name: 'zephyr-edge-contract', root: import.meta.dirname })
);
