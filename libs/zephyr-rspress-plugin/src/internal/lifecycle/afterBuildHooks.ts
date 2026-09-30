interface HookTracker {
  hook: unknown;
  pending: WeakMap<object, Promise<void>[]>;
}

const trackedHooks = new WeakMap<object, HookTracker>();

function trackHook(plugin: unknown): HookTracker | undefined {
  if (
    typeof plugin !== 'object' ||
    plugin === null ||
    !('afterBuild' in plugin) ||
    typeof plugin.afterBuild !== 'function' ||
    ('name' in plugin && plugin.name === 'zephyr-rspress-plugin-ssg')
  ) {
    return undefined;
  }

  const existing = trackedHooks.get(plugin);
  if (existing?.hook === plugin.afterBuild) {
    return existing;
  }

  const originalHook = plugin.afterBuild;
  const pending = new WeakMap<object, Promise<void>[]>();
  const hook = function (this: object, config: object, isProd: boolean) {
    let jobs = pending.get(config);
    if (jobs === undefined) {
      jobs = [];
      pending.set(config, jobs);
    }
    const currentJobs = jobs;
    const job = Promise.resolve().then(async () => {
      await Reflect.apply(originalHook, this, [config, isProd]);
    });
    currentJobs.push(job);
    const remove = () => {
      const index = currentJobs.indexOf(job);
      if (index !== -1) {
        currentJobs.splice(index, 1);
      }
    };
    void job.then(remove, remove);
    return job;
  };

  plugin.afterBuild = hook;
  const tracker = { hook, pending };
  trackedHooks.set(plugin, tracker);
  return tracker;
}

export function trackAfterBuildHooks(plugins: readonly unknown[]) {
  const trackers = plugins.map(trackHook).filter((tracker) => tracker !== undefined);
  return async (config: object): Promise<void> => {
    await Promise.resolve();
    const jobs = trackers.flatMap((tracker) => {
      const job = tracker.pending.get(config)?.shift();
      return job === undefined ? [] : [job];
    });
    await Promise.all(jobs);
  };
}
