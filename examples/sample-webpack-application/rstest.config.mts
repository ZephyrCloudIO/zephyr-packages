import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../rstest.project.mts';

export default defineProject(
  createProjectConfig({
    name: 'example-sample-webpack-application',
    root: import.meta.dirname,
    testEnvironment: 'jsdom',
  })
);
