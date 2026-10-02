import { expect, it, rs } from '@rstest/core';
import { trackAfterBuildHooks } from '../lifecycle/afterBuildHooks';

it('waits for each overlapping rebuild separately and preserves hook context', async () => {
  const gates = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const started = Promise.withResolvers<void>();
  let invocation = 0;
  const afterBuild = rs.fn(async function (
    this: object,
    config: object,
    isProd: boolean
  ) {
    expect(this).toBe(plugin);
    expect(config).toBe(buildConfig);
    expect(isProd).toBe(true);
    const gate = gates[invocation++];
    if (invocation === 2) {
      started.resolve();
    }
    await gate.promise;
  });
  const plugin = { name: 'sitemap', afterBuild };
  const buildConfig = {};
  const wait = trackAfterBuildHooks([plugin]);
  const first = Promise.all([wait(buildConfig), plugin.afterBuild(buildConfig, true)]);
  const second = Promise.all([plugin.afterBuild(buildConfig, true), wait(buildConfig)]);
  let secondFinished = false;
  void second.then(() => {
    secondFinished = true;
  });

  await started.promise;
  gates[0].resolve();
  await first;
  expect(secondFinished).toBe(false);
  gates[1].resolve();
  await second;
  expect(afterBuild).toHaveBeenCalledTimes(2);
});

it('keeps waits separate when two configs share a plugin instance', async () => {
  const firstConfig = {};
  const secondConfig = {};
  const firstGate = Promise.withResolvers<void>();
  const secondGate = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  let invocations = 0;
  const afterBuild = rs.fn(async (config: object, _isProd: boolean) => {
    if (++invocations === 2) {
      started.resolve();
    }
    await (config === firstConfig ? firstGate.promise : secondGate.promise);
  });
  const plugin = { name: 'shared', afterBuild };
  const waitForFirst = trackAfterBuildHooks([plugin]);
  const waitForSecond = trackAfterBuildHooks([plugin]);
  const first = Promise.all([
    waitForFirst(firstConfig),
    plugin.afterBuild(firstConfig, true),
  ]);
  const second = Promise.all([
    plugin.afterBuild(secondConfig, true),
    waitForSecond(secondConfig),
  ]);
  let firstFinished = false;
  void first.then(() => {
    firstFinished = true;
  });

  await started.promise;
  secondGate.resolve();
  await second;
  expect(firstFinished).toBe(false);
  firstGate.resolve();
  await first;
  expect(afterBuild).toHaveBeenCalledTimes(2);
});
