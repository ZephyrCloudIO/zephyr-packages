/**
 * React Native Bundle Management for OTA Updates
 *
 * CRITICAL: React Native bundle loading reality vs our assumptions:
 *
 * - RN bundles are typically monolithic, not federated
 * - Dynamic remote loading requires specific setups (Re.Pack + proper chunking)
 * - Standard RN OTA means replacing entire app bundle
 * - Manifest updates alone don't reload code - they change configuration
 */

interface RNBundleUpdateStrategy {
  type: 'restart_required' | 'hot_reload' | 'config_only';
  reason: string;
  action: () => Promise<void>;
}

export class ReactNativeBundleManager {
  private static instance: ReactNativeBundleManager;

  static getInstance(): ReactNativeBundleManager {
    if (!ReactNativeBundleManager.instance) {
      ReactNativeBundleManager.instance = new ReactNativeBundleManager();
    }
    return ReactNativeBundleManager.instance;
  }

  /** Determine update strategy based on RN environment capabilities */
  async determineUpdateStrategy(
    currentManifest: any,
    newManifest: any
  ): Promise<RNBundleUpdateStrategy> {
    // Check if we're in a Module Federation environment (Re.Pack)
    const hasModuleFederation = this.hasModuleFederationCapability();

    // Check if this is just a config change vs code change
    const isConfigOnly = this.isConfigOnlyChange(currentManifest, newManifest);

    // Check if we're in development mode with hot reload
    const isDevelopmentWithHotReload = __DEV__ && this.hasHotReloadCapability();

    if (isConfigOnly) {
      return {
        type: 'config_only',
        reason: 'Only configuration changed, no code reload needed',
        action: async () => {
          // Just update app state/configuration
          await this.updateConfiguration(newManifest);
        },
      };
    }

    if (hasModuleFederation) {
      return {
        type: 'hot_reload',
        reason: 'Module Federation detected, can hot-reload remotes',
        action: async () => {
          await this.hotReloadModuleFederationRemotes(newManifest);
        },
      };
    }

    if (isDevelopmentWithHotReload) {
      return {
        type: 'hot_reload',
        reason: 'Development mode with hot reload available',
        action: async () => {
          await this.triggerDevelopmentReload();
        },
      };
    }

    // Default: restart required for standard RN apps
    return {
      type: 'restart_required',
      reason: 'Standard RN app requires restart for code updates',
      action: async () => {
        await this.notifyRestartRequired(newManifest);
      },
    };
  }

  private hasModuleFederationCapability(): boolean {
    try {
      // Check if Re.Pack or similar MF solution is available
      const global = this.getGlobalObject();
      return !!(
        global.__webpack_require__ ||
        global.__rspack_require__ ||
        global.webpackChunkName ||
        global.__MF_RUNTIME__
      );
    } catch {
      return false;
    }
  }

  private hasHotReloadCapability(): boolean {
    try {
      const global = this.getGlobalObject();
      return !!(
        global.__DEV__ &&
        (global.HMRClient || global.__hmrClient || global.__reactRefresh)
      );
    } catch {
      return false;
    }
  }

  private isConfigOnlyChange(current: any, updated: any): boolean {
    if (!current || !updated) return false;

    // Compare dependencies to see if only URLs changed (not structure)
    const currentDeps = current.dependencies || {};
    const updatedDeps = updated.dependencies || {};

    const currentKeys = Object.keys(currentDeps).sort();
    const updatedKeys = Object.keys(updatedDeps).sort();

    // If dependency structure changed, it's not config-only
    if (JSON.stringify(currentKeys) !== JSON.stringify(updatedKeys)) {
      return false;
    }

    // Check if only URLs changed
    for (const key of currentKeys) {
      const currentDep = currentDeps[key];
      const updatedDep = updatedDeps[key];

      // If anything other than URLs changed, it's not config-only
      if (
        currentDep.name !== updatedDep.name ||
        currentDep.library_type !== updatedDep.library_type
      ) {
        return false;
      }
    }

    return true;
  }

  private async updateConfiguration(manifest: any): Promise<void> {
    // Update app configuration without code reload
    const global = this.getGlobalObject();

    if (global.__ZEPHYR_RUNTIME_CONFIG__) {
      global.__ZEPHYR_RUNTIME_CONFIG__ = {
        ...global.__ZEPHYR_RUNTIME_CONFIG__,
        manifest,
        lastUpdated: Date.now(),
      };
    }

    console.log('[Zephyr OTA] Configuration updated without restart');
  }

  private async hotReloadModuleFederationRemotes(manifest: any): Promise<void> {
    const global = this.getGlobalObject();

    try {
      // Attempt to clear module cache for remotes
      if (global.__webpack_require__?.cache) {
        const cache = global.__webpack_require__.cache;
        Object.keys(cache).forEach((key) => {
          if (key.includes('remote') || key.includes('federation')) {
            delete cache[key];
          }
        });
      }

      // Update manifest for runtime plugin
      if (global.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__) {
        await global.__ZEPHYR_RUNTIME_PLUGIN_INSTANCE__.refresh();
      }

      console.log('[Zephyr OTA] Module Federation remotes hot-reloaded');
    } catch (error) {
      console.warn('[Zephyr OTA] Hot reload failed, restart may be required:', error);
      throw error;
    }
  }

  private async triggerDevelopmentReload(): Promise<void> {
    const global = this.getGlobalObject();

    try {
      // Try React Native's dev reload
      if (global.HMRClient) {
        global.HMRClient.reload();
      } else if (global.__hmrClient) {
        global.__hmrClient.reload();
      } else {
        // Fallback: use React Native's dev menu reload
        const { DevSettings } = require('react-native');
        DevSettings.reload();
      }
    } catch (error) {
      console.warn('[Zephyr OTA] Development reload failed:', error);
      // Fall back to restart notification
      await this.notifyRestartRequired();
    }
  }

  private async notifyRestartRequired(manifest?: any): Promise<void> {
    const global = this.getGlobalObject();

    // Notify the app that restart is required
    if (global.__ZEPHYR_OTA_RESTART_REQUIRED__) {
      global.__ZEPHYR_OTA_RESTART_REQUIRED__(manifest);
    }

    console.log('[Zephyr OTA] App restart required for code updates');
  }

  /** Safe global object access for different RN engines */
  private getGlobalObject(): any {
    // Hermes, JSC, V8 compatibility
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof global !== 'undefined') return global;
    if (typeof window !== 'undefined') return window;
    if (typeof self !== 'undefined') return self;

    // Fallback
    return {};
  }

  /** Check current React Native environment capabilities */
  getEnvironmentInfo() {
    const global = this.getGlobalObject();

    return {
      engine: this.getJSEngine(),
      hasModuleFederation: this.hasModuleFederationCapability(),
      hasHotReload: this.hasHotReloadCapability(),
      isDevelopment: __DEV__,
      platform: global.__RN_PLATFORM__ || 'unknown',
      version: global.__RN_VERSION__ || 'unknown',
    };
  }

  private getJSEngine(): string {
    const global = this.getGlobalObject();

    if (global.HermesInternal) return 'hermes';
    if (global._v8runtime) return 'v8';
    if (global.nativePerformanceNow) return 'jsc';

    return 'unknown';
  }
}

/** React Native specific update strategies */
export const RNUpdateStrategies = {
  /**
   * For standard React Native apps (no Module Federation) Updates require app restart or
   * CodePush-style bundle replacement
   */
  STANDARD_RN: 'standard_rn',

  /** For Re.Pack + Module Federation setup Can hot-reload individual remotes */
  MODULE_FEDERATION: 'module_federation',

  /** For development with Metro dev server Can use hot reload capabilities */
  DEVELOPMENT_HOT_RELOAD: 'development_hot_reload',

  /** For configuration-only changes No code reload needed */
  CONFIG_ONLY: 'config_only',
} as const;
