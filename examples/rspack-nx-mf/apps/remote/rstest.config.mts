import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../../../rstest.project.mts';

export default defineProject(
  createProjectConfig({
    name: 'example-rspack-remote',
    root: import.meta.dirname,
    testEnvironment: 'jsdom',
  })
);
