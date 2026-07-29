import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  compilationHooks: rs.fn(),
  detectBaseHref: rs.fn(),
  detectAndStoreBaseHref: rs.fn(),
  logBuildSteps: rs.fn(),
  setupManifestEmission: rs.fn(),
  setupZeDeploy: rs.fn(),
  buildEnvImportMap: rs.fn(),
  zeLogMisc: rs.fn(),
}));

rs.mock('@rspack/core', () => ({
  HtmlRspackPlugin: {
    getCompilationHooks: mocks.compilationHooks,
  },
}));

rs.mock('zephyr-agent', () => ({
  buildEnvImportMap: mocks.buildEnvImportMap,
  ze_log: { misc: mocks.zeLogMisc },
}));

rs.mock('zephyr-xpack-internal', () => ({
  detectBaseHref: mocks.detectBaseHref,
  detectAndStoreBaseHref: mocks.detectAndStoreBaseHref,
  logBuildSteps: mocks.logBuildSteps,
  setupManifestEmission: mocks.setupManifestEmission,
  setupZeDeploy: mocks.setupZeDeploy,
}));

import { ZeRspackPlugin } from './ze-rspack-plugin';

function compiler() {
  const existingRule = { test: /existing-loader/ };
  const existingExternals = { react: 'commonjs react' };
  const compilationTap = rs.fn();
  return {
    compiler: {
      outputPath: '/repo/dist',
      options: {
        module: { rules: [existingRule] },
        externals: existingExternals,
      },
      hooks: {
        compilation: { tap: compilationTap },
      },
    },
    existingRule,
    existingExternals,
    compilationTap,
  };
}

function plugin(target: 'web' | 'tap-app', resolvedManifestUrl?: string) {
  return new ZeRspackPlugin({
    zephyr_engine: {
      application_uid: 'org.project.rspack',
      env: { target },
      buildProperties: {},
      federated_dependencies: [],
    } as never,
    mfConfig: undefined,
    resolvedManifestUrl,
  });
}

describe('ZeRspackPlugin locked TAP output', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('keeps publication hooks but skips import-map and virtual-env byte transforms for tap-app', () => {
    const subject = compiler();

    plugin('tap-app').apply(subject.compiler as never);

    expect(mocks.detectAndStoreBaseHref).toHaveBeenCalledWith(
      expect.anything(),
      subject.compiler
    );
    expect(mocks.logBuildSteps).toHaveBeenCalledTimes(1);
    expect(mocks.setupManifestEmission).toHaveBeenCalledTimes(1);
    expect(mocks.setupZeDeploy).toHaveBeenCalledTimes(1);
    expect(subject.compilationTap).not.toHaveBeenCalled();
    expect(subject.compiler.options.module.rules).toEqual([subject.existingRule]);
    expect(subject.compiler.options.externals).toBe(subject.existingExternals);
  });

  it('retains web import-map and virtual-env setup', () => {
    const subject = compiler();

    plugin('web').apply(subject.compiler as never);

    expect(subject.compilationTap).toHaveBeenCalledTimes(1);
    expect(subject.compiler.options.module.rules).toEqual([
      expect.objectContaining({
        use: [
          expect.objectContaining({
            loader: expect.stringContaining('env-virtual-loader.js'),
          }),
        ],
      }),
      subject.existingRule,
    ]);
    expect(subject.compiler.options.externals).toEqual(
      expect.objectContaining({
        react: 'commonjs react',
        'env:vars:org.project.rspack': 'module env:vars:org.project.rspack',
      })
    );
  });

  it('maps the application env module to the resolved self manifest URL', async () => {
    const subject = compiler();
    const tapPromise = rs.fn();
    mocks.compilationHooks.mockReturnValue({
      afterTemplateExecution: { tapPromise },
    });
    mocks.buildEnvImportMap.mockReturnValue({
      'env:vars:org.project.rspack':
        'https://cdn.example.test/customer/app/zephyr-manifest.json',
    });

    plugin('web', 'https://cdn.example.test/customer/app/zephyr-manifest.json').apply(
      subject.compiler as never
    );
    const compilationHandler = subject.compilationTap.mock.calls[0]?.[1];
    compilationHandler({});
    const htmlHandler = tapPromise.mock.calls[0]?.[1];
    await htmlHandler({ headTags: [] });

    expect(mocks.buildEnvImportMap).toHaveBeenCalledWith(
      'org.project.rspack',
      [],
      'https://cdn.example.test/customer/app/zephyr-manifest.json'
    );
  });
});
