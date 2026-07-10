import { defineProject } from '@rstest/core';
import path from 'node:path';
import { createProjectConfig } from '../../../../rstest.project.mts';

export default defineProject(
  createProjectConfig({
    name: 'example-rspack-host',
    root: import.meta.dirname,
    testEnvironment: 'jsdom',
    resolve: {
      alias: {
        'rspack_nx_mf_remote/Module': path.resolve(
          import.meta.dirname,
          'test/remote-module-stub.tsx'
        ),
      },
    },
  })
);
