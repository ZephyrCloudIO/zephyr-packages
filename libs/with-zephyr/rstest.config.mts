import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../scripts/rstest/project-config.mts';

export default defineProject(
  createProjectConfig({ name: 'with-zephyr', root: import.meta.dirname })
);
