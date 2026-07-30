import { describe, expect, it } from '@rstest/core';
import { createNextSteps, formatScaffoldFailure } from './presentation.js';

describe('CLI presentation', () => {
  it('preserves React Native setup commands and Re.Pack documentation', () => {
    const nextSteps = createNextSteps({
      outputDirectory: '/workspace/mobile-app',
      invocationDirectory: '/workspace',
      packageManager: 'pnpm',
      projectType: 'react-native',
      alreadyInstalled: false,
      alreadyBuilt: false,
    });

    expect(nextSteps.commands).toContain('cd ./mobile-app');
    expect(nextSteps.commands).toContain('pnpm install');
    expect(nextSteps.commands).toContain(
      'git remote add origin https://github.com/<name>/mobile-app.git'
    );
    expect(nextSteps.commands).toContain('ZC=1 pnpm start');
    expect(nextSteps.documentationUrl).toBe(
      'https://docs.zephyr-cloud.io/bundlers/repack'
    );
    expect(nextSteps.guidance?.body).toContain('Make sure to commit and add a remote');
  });

  it('does not recommend reinstalling dependencies after --install', () => {
    const nextSteps = createNextSteps({
      outputDirectory: '/workspace/web-app',
      invocationDirectory: '/workspace',
      packageManager: 'pnpm',
      projectType: 'web',
      template: 'react-rsbuild',
      alreadyInstalled: true,
      alreadyBuilt: false,
    });

    expect(nextSteps.commands).toBe('cd ./web-app\npnpm run build');
  });

  it('routes web templates to their bundler documentation', () => {
    const documentationUrl = (template: string): string =>
      createNextSteps({
        outputDirectory: '/workspace/web-app',
        invocationDirectory: '/workspace',
        packageManager: 'pnpm',
        projectType: 'web',
        template,
        alreadyInstalled: false,
        alreadyBuilt: false,
      }).documentationUrl;

    expect(documentationUrl('react-rsbuild')).toBe(
      'https://docs.zephyr-cloud.io/bundlers/rsbuild'
    );
    expect(documentationUrl('react-webpack')).toBe(
      'https://docs.zephyr-cloud.io/bundlers/webpack'
    );
    expect(documentationUrl('react-vite')).toBe(
      'https://docs.zephyr-cloud.io/bundlers/vite'
    );
  });

  it('includes captured command diagnostics in plain-text failures', () => {
    expect(
      formatScaffoldFailure({
        message: 'pnpm exited with code 1.',
        receipt: {
          failures: [
            {
              stderr: 'ERR_PNPM_FETCH_404 package not found',
            },
          ],
        },
      })
    ).toBe('pnpm exited with code 1.\n\nERR_PNPM_FETCH_404 package not found');
  });
});
