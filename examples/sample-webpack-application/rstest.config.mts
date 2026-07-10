import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../scripts/rstest/project-config.mts';

export default defineProject(
  createProjectConfig({
    name: 'example-sample-webpack-application',
    root: import.meta.dirname,
    testEnvironment: 'jsdom',
  })
);
