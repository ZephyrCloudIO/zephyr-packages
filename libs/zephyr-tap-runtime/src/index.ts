import type { TapLifecycle } from './types';

declare module '@module-federation/runtime-core' {
  interface ModuleFederation {
    /** Installed by `createTapLifecycleRuntimePlugin` on trusted TAP hosts. */
    tapLifecycle?: TapLifecycle;
  }
}

declare module '@module-federation/runtime' {
  interface ModuleFederation {
    /** Installed by `createTapLifecycleRuntimePlugin` on trusted TAP hosts. */
    tapLifecycle?: TapLifecycle;
  }
}

export {
  createTapLifecycleRuntimePlugin,
  type TapLifecycleRuntimePlugin,
} from './runtime-plugin';
export { TapLifecycleCoordinator } from './tap-lifecycle';
export type {
  TapCheckpoint,
  TapCommittedLifecycleListener,
  TapLifecycle,
  TapLifecycleAuthorizationContext,
  TapLifecycleAuthorizationResult,
  TapLifecycleContext,
  TapLifecycleError,
  TapLifecycleErrorKind,
  TapLifecycleErrorListener,
  TapLifecycleHooks,
  TapLifecycleKind,
  TapLifecyclePhase,
  TapLifecyclePlatformAdapter,
  TapLifecyclePluginOptions,
  TapLifecycleRequest,
  TapLifecycleResult,
  TapLifecycleScope,
  TapLifecycleStatus,
  TapLifecycleTransition,
  TapPreDecision,
  TapPreDecisionAggregation,
  TapPreDecisionPolicy,
  TapPreDecisionRecord,
  TapPreLifecycleListener,
  TapResolvedPreDecision,
} from './types';
