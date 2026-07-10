import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../scripts/rstest/project-config.mts';

export default defineProject(
  createProjectConfig({ name: 'vite-plugin-tanstack-start-zephyr', root: import.meta.dirname })
);
