import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../scripts/rstest/project-config.mts';

export default defineProject(
  createProjectConfig({
    name: 'example-rollup-sample-lib',
    root: import.meta.dirname,
    testEnvironment: 'jsdom',
  })
);
