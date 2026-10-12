import { defineProject } from '@rstest/core';
import { createProjectConfig } from '../../rstest.project.mts';

export default defineProject(
  createProjectConfig({
    name: 'zephyr-mcp',
    root: import.meta.dirname,
    // Fixture repos contain tool files named *.test.ts on purpose.
    include: ['__tests__/*.spec.ts'],
    testTimeout: 60_000,
  })
);
