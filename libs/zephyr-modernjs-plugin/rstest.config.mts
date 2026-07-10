import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../rstest.project.mts';

export default defineProject(
  createProjectConfig({ name: 'zephyr-modernjs-plugin', root: import.meta.dirname })
);
