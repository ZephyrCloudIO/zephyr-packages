import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../rstest.project.mts';

export default defineProject(
  createProjectConfig({ name: 'vite-plugin-tanstack-start-zephyr', root: import.meta.dirname })
);
