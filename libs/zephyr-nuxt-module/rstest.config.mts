import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../rstest.project.mts';

export default defineProject(
  createProjectConfig({ name: 'zephyr-nuxt-module', root: import.meta.dirname })
);
