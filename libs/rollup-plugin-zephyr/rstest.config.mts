import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../rstest.project.mts';

export default defineProject(
  createProjectConfig({ name: 'rollup-plugin-zephyr', root: import.meta.dirname })
);
