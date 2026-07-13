# zephyr-tap-runtime

`zephyr-tap-runtime` is a host-only Module Federation runtime plugin that
attaches a typed, serial TAP pause/resume coordinator to a federation instance.

The host supplies authorization, checkpoint, and persistence operations through
the required platform adapter. The package only coordinates those calls and
publishes lifecycle observations; it does not own package state or policy.

```ts
import { createTapLifecycleRuntimePlugin } from 'zephyr-tap-runtime';
import { tapPlatformAdapter } from './tap-platform-adapter';

const lifecycle = createTapLifecycleRuntimePlugin({
  platform: tapPlatformAdapter,
});
```

Register the plugin in the trusted host runtime. Its `apply(instance)` method is
idempotent, and exposes `instance.tapLifecycle.pause()` and
`instance.tapLifecycle.resume()`.
