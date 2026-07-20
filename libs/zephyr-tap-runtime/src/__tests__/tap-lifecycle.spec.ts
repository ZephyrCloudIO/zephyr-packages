import { describe, expect, it } from '@rstest/core';
import type { ModuleFederation } from '@module-federation/runtime';
import {
  createTapLifecycleRuntimePlugin,
  TapLifecycleCoordinator,
  type TapLifecyclePlatformAdapter,
  type TapLifecycleRequest,
} from '../index';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function request(overrides: Partial<TapLifecycleRequest> = {}): TapLifecycleRequest {
  return {
    scope: 'mount',
    scopeId: 'mini-app:primary',
    reason: 'host-request',
    force: false,
    deadline: Date.now() + 1_000,
    ...overrides,
  };
}

function platform(
  overrides: Partial<TapLifecyclePlatformAdapter> = {}
): TapLifecyclePlatformAdapter {
  return {
    authorize: async () => ({ allowed: true }),
    createCheckpoint: async () => undefined,
    persistPaused: async () => undefined,
    loadCheckpoint: async () => undefined,
    persistResumed: async () => undefined,
    ...overrides,
  };
}

describe('zephyr-tap-runtime', () => {
  it('attaches one typed lifecycle coordinator when core calls apply repeatedly', async () => {
    let prePauseCalls = 0;
    const plugin = createTapLifecycleRuntimePlugin({
      platform: platform(),
      hooks: {
        prePause: () => {
          prePauseCalls += 1;
          return { kind: 'continue' };
        },
      },
    });
    const instance = { name: 'host' } as unknown as ModuleFederation;

    plugin.apply(instance);
    const first = instance.tapLifecycle;
    plugin.apply(instance);
    plugin.apply(instance);

    expect(first).toBeDefined();
    expect(instance.tapLifecycle).toBe(first);
    expect(Object.keys(instance)).not.toContain('tapLifecycle');

    const result = await first!.pause(request());
    expect(result.status).toBe('completed');
    expect(prePauseCalls).toBe(1);
  });

  it('serializes one scope and stamps unique IDs with monotonic epochs', async () => {
    const order: string[] = [];
    const lifecycle = new TapLifecycleCoordinator({
      platform: platform({
        createCheckpoint: async ({ transition }) => {
          order.push(`checkpoint:${transition.lifecycleEpoch}:start`);
          await wait(12);
          order.push(`checkpoint:${transition.lifecycleEpoch}:end`);
          return { checkpointReference: `cp-${transition.lifecycleEpoch}` };
        },
        persistPaused: async ({ transition }) => {
          order.push(`persist:${transition.lifecycleEpoch}`);
        },
      }),
    });

    const first = lifecycle.pause(request());
    const second = lifecycle.pause(request());
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.status).toBe('completed');
    expect(secondResult.status).toBe('completed');
    expect(firstResult.transition.lifecycleEpoch).toBe(0);
    expect(secondResult.transition.lifecycleEpoch).toBe(1);
    expect(firstResult.transition.transitionId).not.toBe(
      secondResult.transition.transitionId
    );
    expect(order).toEqual([
      'checkpoint:0:start',
      'checkpoint:0:end',
      'persist:0',
      'checkpoint:1:start',
      'checkpoint:1:end',
      'persist:1',
    ]);

    await expect(lifecycle.pause(request({ lifecycleEpoch: 1 }))).rejects.toThrow(
      'must be greater than 1'
    );
  });

  it('allows independent scopes to progress concurrently', async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    let markSecondStarted!: () => void;
    const secondStarted = new Promise<void>((resolve) => {
      markSecondStarted = resolve;
    });
    const lifecycle = new TapLifecycleCoordinator({
      platform: platform({
        createCheckpoint: async ({ transition }) => {
          if (transition.scopeId === 'first') {
            markFirstStarted();
            await firstGate;
            return { checkpointReference: 'first-checkpoint' };
          }
          markSecondStarted();
          return { checkpointReference: 'second-checkpoint' };
        },
      }),
    });

    const first = lifecycle.pause(request({ scopeId: 'first' }));
    await firstStarted;
    const second = lifecycle.pause(request({ scopeId: 'second' }));
    await Promise.race([
      secondStarted,
      wait(100).then(() => {
        throw new Error('the second scope was incorrectly queued behind the first');
      }),
    ]);
    releaseFirst();

    expect((await first).status).toBe('completed');
    expect((await second).status).toBe('completed');
  });

  it('aggregates bounded deferrals and ignores voluntary deferrals when forced', async () => {
    const lifecycle = new TapLifecycleCoordinator({
      platform: platform(),
      preDecision: { aggregation: 'max-delay', maxDelayMs: 20 },
    });
    lifecycle.on('prePause', () => ({ kind: 'defer', delayMs: 70 }));
    lifecycle.on('prePause', () => ({ kind: 'defer', delayMs: 10 }));

    const startedAt = Date.now();
    const bounded = await lifecycle.pause(request());
    const elapsed = Date.now() - startedAt;

    expect(bounded.status).toBe('completed');
    expect(bounded.decision).toEqual({
      aggregation: 'max-delay',
      kind: 'defer',
      delayMs: 20,
      honored: false,
    });
    expect(bounded.decisions.map((entry) => entry.honored)).toEqual([false, true]);
    expect(elapsed).toBeGreaterThanOrEqual(15);

    const forced = await lifecycle.pause(request({ force: true }));
    expect(forced.status).toBe('completed');
    expect(forced.decision).toEqual({
      aggregation: 'max-delay',
      kind: 'continue',
      honored: false,
    });
    expect(forced.decisions.map((entry) => entry.honored)).toEqual([false, false]);
  });

  it('requires every pre-listener to defer when using all-decision aggregation', async () => {
    const lifecycle = new TapLifecycleCoordinator({
      platform: platform(),
      preDecision: { aggregation: 'all', maxDelayMs: 20 },
    });
    lifecycle.on('prePause', () => ({ kind: 'defer', delayMs: 5 }));
    lifecycle.on('prePause', () => ({ kind: 'continue' }));

    const result = await lifecycle.pause(request());

    expect(result.status).toBe('completed');
    expect(result.decision).toEqual({
      aggregation: 'all',
      kind: 'continue',
      honored: false,
    });
    expect(result.decisions.map((entry) => entry.honored)).toEqual([false, true]);
  });

  it('composes host cancellation with its own signal and reports a deadline once', async () => {
    let entered!: () => void;
    const enteredPrePause = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let lifecycleSignal: AbortSignal | undefined;
    const lifecycle = new TapLifecycleCoordinator({ platform: platform() });
    lifecycle.on('prePause', async ({ transition }) => {
      lifecycleSignal = transition.signal;
      entered();
      await new Promise<void>(() => undefined);
      return { kind: 'continue' };
    });

    const external = new AbortController();
    const pending = lifecycle.pause(request({ signal: external.signal }));
    await enteredPrePause;
    external.abort(new Error('host shutdown'));
    const cancelled = await pending;

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.transition.signal).not.toBe(external.signal);
    expect(lifecycleSignal).toBe(cancelled.transition.signal);
    expect(cancelled.transition.signal.aborted).toBe(true);

    const errors: string[] = [];
    const deadlineLifecycle = new TapLifecycleCoordinator({
      platform: platform({
        authorize: async () => new Promise(() => undefined),
      }),
    });
    deadlineLifecycle.on('lifecycleError', (event) => {
      errors.push(event.kind);
    });

    const timedOut = await deadlineLifecycle.pause(
      request({ deadline: Date.now() + 15 })
    );
    expect(timedOut.status).toBe('timed_out');
    expect(timedOut.errors.filter((error) => error.kind === 'deadline')).toHaveLength(1);
    expect(errors).toEqual(['deadline']);
  });

  it('does not run a queued transition after its absolute deadline expires', async () => {
    let authorizations = 0;
    const lifecycle = new TapLifecycleCoordinator({
      platform: platform({
        authorize: async () => {
          authorizations += 1;
          return { allowed: true };
        },
      }),
    });
    lifecycle.on('prePause', async () => {
      await wait(200);
      return { kind: 'continue' };
    });

    const first = lifecycle.pause(request({ deadline: Date.now() + 1000 }));
    await wait(10);
    const queued = lifecycle.pause(request({ deadline: Date.now() + 50 }));
    const [, expired] = await Promise.all([first, queued]);

    expect(expired.status).toBe('timed_out');
    expect(authorizations).toBe(1);
  });

  it('fans out committed and error observers serially without losing a checkpoint on resume', async () => {
    const order: string[] = [];
    const persistedReferences: string[] = [];
    const lifecycle = new TapLifecycleCoordinator({
      platform: platform({
        createCheckpoint: async () => ({
          checkpointReference: 'checkpoint:42',
          value: { openPanels: ['settings'] },
        }),
        persistPaused: async ({ checkpointReference }) => {
          persistedReferences.push(`paused:${checkpointReference}`);
        },
        loadCheckpoint: async ({ checkpointReference }) => {
          persistedReferences.push(`loaded:${checkpointReference}`);
          return { value: { openPanels: ['settings'] } };
        },
        persistResumed: async ({ checkpointReference }) => {
          persistedReferences.push(`resumed:${checkpointReference}`);
        },
      }),
    });
    lifecycle.on('pause', async () => {
      order.push('pause:one:start');
      await wait(4);
      order.push('pause:one:end');
      throw new Error('first observer failed');
    });
    lifecycle.on('pause', () => {
      order.push('pause:two');
    });
    lifecycle.on('lifecycleError', async () => {
      order.push('error:one:start');
      await wait(4);
      order.push('error:one:end');
      throw new Error('error observer failed');
    });
    lifecycle.on('lifecycleError', () => {
      order.push('error:two');
    });
    lifecycle.on('resume', ({ checkpointReference }) => {
      order.push(`resume:${checkpointReference}`);
    });

    const paused = await lifecycle.pause(request());
    const resumed = await lifecycle.resume(request());

    expect(paused.status).toBe('completed');
    expect(paused.checkpointReference).toBe('checkpoint:42');
    expect(resumed.status).toBe('completed');
    expect(resumed.checkpointReference).toBe('checkpoint:42');
    expect(persistedReferences).toEqual([
      'paused:checkpoint:42',
      'loaded:checkpoint:42',
      'resumed:checkpoint:42',
    ]);
    expect(order).toEqual([
      'pause:one:start',
      'pause:one:end',
      'error:one:start',
      'error:one:end',
      'error:two',
      'pause:two',
      'resume:checkpoint:42',
    ]);
    expect(paused.errors).toHaveLength(2);
    expect(paused.errors.map((error) => error.phase)).toEqual([
      'pause',
      'lifecycleError',
    ]);
  });
});
